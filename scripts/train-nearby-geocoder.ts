import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import {
  nearbyGeocodeFeatures,
  nearbyGeocodeScore,
  nearbyGeocoderFeatureNames,
  type NearbyGeocodeCandidate,
  type NearbyGeocodeSource,
  type NearbyGeocoderFeature,
  type NearbyGeocoderWeights,
} from "../lib/nearby-geocoder.ts";

type TrainingRecord = NearbyGeocodeSource & { id: string };
type Example = { provider: TrainingRecord; candidate: NearbyGeocodeCandidate; label: 0 | 1 };
type Model = {
  version: 1;
  featureNames: readonly NearbyGeocoderFeature[];
  weights: NearbyGeocoderWeights;
  bias: number;
  threshold: number;
  trainingRecords: number;
  trainingSamples: number;
  validation: {
    source: string;
    samples: number;
    accuracy: number;
    precision: number;
    recall: number;
  };
};

const databasePath = resolve(process.env.DATABASE_PATH || "data/hub.sqlite");
const outputPath = resolve("server/nearby-geocoder-model.json");
const db = new Database(databasePath, { readonly: true, fileMustExist: true });
db.pragma("query_only = ON");

function extractHouseNumber(address: string) {
  return (
    address.match(/(?:^|[,\s])(?:n(?:[º°.]|umero)?\s*)?(\d+[a-z]?)(?=\s*(?:[,/\-]|$))/i)?.[1] ?? ""
  );
}

function streetPart(address: string, houseNumber: string) {
  if (!houseNumber) return address;
  const escaped = houseNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return address
    .replace(
      new RegExp(`[,\\s]+(?:n(?:[º°.]|umero)?\\s*)?${escaped}(?=\\s*(?:[,/\\-]|$))`, "i"),
      "",
    )
    .trim();
}

function syntheticCandidate(record: TrainingRecord, includeName: boolean, includeNumber: boolean) {
  const number = extractHouseNumber(record.address);
  const road = streetPart(record.address, number);
  const visibleAddress = includeNumber ? record.address : road;
  return {
    name: includeName ? record.name : "",
    display_name: [visibleAddress, record.city, "Amazonas", "Brasil"].filter(Boolean).join(", "),
    address: {
      road,
      ...(includeNumber && number ? { house_number: number } : {}),
      city: record.city,
      municipality: record.city,
      state: "Amazonas",
      country_code: "br",
    },
  } satisfies NearbyGeocodeCandidate;
}

function stableHoldout(id: string) {
  return Number.parseInt(createHash("sha1").update(id).digest("hex").slice(0, 8), 16) % 5 === 0;
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
}

function train(examples: Example[]) {
  const weights = Object.fromEntries(
    nearbyGeocoderFeatureNames.map((name) => [name, 0]),
  ) as NearbyGeocoderWeights;
  let bias = 0;
  const epochs = 1600;
  const learningRate = 0.18;
  const regularization = 0.0005;
  const vectors = examples.map((example) => ({
    features: nearbyGeocodeFeatures(example.provider, example.candidate),
    label: example.label,
  }));

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradients = Object.fromEntries(
      nearbyGeocoderFeatureNames.map((name) => [name, 0]),
    ) as NearbyGeocoderWeights;
    let biasGradient = 0;
    for (const sample of vectors) {
      let linear = bias;
      for (const name of nearbyGeocoderFeatureNames)
        linear += sample.features[name] * weights[name];
      const error = sigmoid(linear) - sample.label;
      biasGradient += error;
      for (const name of nearbyGeocoderFeatureNames)
        gradients[name] += error * sample.features[name];
    }
    const scale = learningRate / vectors.length;
    bias -= scale * biasGradient;
    for (const name of nearbyGeocoderFeatureNames)
      weights[name] -= scale * (gradients[name] + regularization * weights[name]);
  }
  return { weights, bias };
}

function metrics(
  examples: Example[],
  weights: NearbyGeocoderWeights,
  bias: number,
  threshold: number,
) {
  let correct = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const example of examples) {
    const predicted =
      nearbyGeocodeScore(example.provider, example.candidate, weights, bias) >= threshold;
    if (predicted === Boolean(example.label)) correct++;
    if (predicted && example.label) truePositive++;
    if (predicted && !example.label) falsePositive++;
    if (!predicted && example.label) falseNegative++;
  }
  return {
    accuracy: examples.length ? correct / examples.length : 0,
    precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0,
    recall: truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0,
  };
}

function chooseThreshold(examples: Example[], weights: NearbyGeocoderWeights, bias: number) {
  let best = { threshold: 0.82, recall: -1 };
  for (let step = 50; step <= 98; step++) {
    const threshold = step / 100;
    const result = metrics(examples, weights, bias, threshold);
    if (result.precision >= 0.96 && result.recall > best.recall)
      best = { threshold, recall: result.recall };
  }
  return best.threshold;
}

try {
  const records = db
    .prepare<[], TrainingRecord>(
      `SELECT id,name,address,city FROM cadastur_entries
       WHERE category='hospedagens' AND uf='AM' AND published=1
         AND review_status='reviewed' AND TRIM(address)<>''
       ORDER BY id`,
    )
    .all();
  if (records.length < 20)
    throw new Error(
      "São necessários pelo menos 20 endereços públicos do Cadastur para treinar o modelo.",
    );

  const byCity = new Map<string, TrainingRecord[]>();
  for (const record of records) {
    const city = record.city
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const cityRecords = byCity.get(city) ?? [];
    cityRecords.push(record);
    byCity.set(city, cityRecords);
  }

  const examples: Example[] = [];
  for (const provider of records) {
    const positives = [
      syntheticCandidate(provider, true, true),
      syntheticCandidate(provider, false, true),
      syntheticCandidate(provider, false, false),
    ];
    for (const candidate of positives) examples.push({ provider, candidate, label: 1 });

    const sameCity =
      byCity.get(
        provider.city
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      ) ?? [];
    if (sameCity.length < 2) continue;
    const index = sameCity.findIndex((record) => record.id === provider.id);
    for (let offset = 1; offset <= Math.min(4, sameCity.length - 1); offset++) {
      const candidateRecord = sameCity[(index + offset) % sameCity.length];
      examples.push({
        provider,
        candidate: syntheticCandidate(candidateRecord, true, true),
        label: 0,
      });
    }
  }

  const trainingExamples = examples.filter((example) => !stableHoldout(example.provider.id));
  const validationExamples = examples.filter((example) => stableHoldout(example.provider.id));
  if (!trainingExamples.length || !validationExamples.length)
    throw new Error("Não foi possível separar os registros entre treino e validação.");

  const { weights, bias } = train(trainingExamples);
  const threshold = chooseThreshold(validationExamples, weights, bias);
  const validation = metrics(validationExamples, weights, bias, threshold);
  const validationCurve = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95].map((candidateThreshold) => ({
    threshold: candidateThreshold,
    ...metrics(validationExamples, weights, bias, candidateThreshold),
  }));
  const model: Model = {
    version: 1,
    featureNames: nearbyGeocoderFeatureNames,
    weights,
    bias: Number(bias.toFixed(6)),
    threshold: Number(threshold.toFixed(2)),
    trainingRecords: new Set(trainingExamples.map((example) => example.provider.id)).size,
    trainingSamples: trainingExamples.length,
    validation: {
      source:
        "Pares sintéticos derivados de endereços Cadastur; não substitui validação geográfica real.",
      samples: validationExamples.length,
      accuracy: Number(validation.accuracy.toFixed(4)),
      precision: Number(validation.precision.toFixed(4)),
      recall: Number(validation.recall.toFixed(4)),
    },
  };

  writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        output: outputPath,
        cadasturLodgings: records.length,
        trainedRecords: model.trainingRecords,
        trainingSamples: model.trainingSamples,
        threshold: model.threshold,
        validation: model.validation,
        validationCurve,
        note: "Validação sintética. Nenhum endereço foi enviado a serviço externo durante o treinamento.",
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
