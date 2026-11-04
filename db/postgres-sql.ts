export function toPostgresSql(sql: string) {
  let parameter = 0;
  let index = 0;
  let result = "";

  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];

    if (character === "'" || character === '"' || character === "`") {
      const delimiter = character;
      result += character;
      index += 1;

      while (index < sql.length) {
        const current = sql[index];
        result += current;
        index += 1;

        if (current === delimiter) {
          if (sql[index] === delimiter) {
            result += sql[index];
            index += 1;
          } else {
            break;
          }
        }
      }
      continue;
    }

    if (character === "[") {
      const end = sql.indexOf("]", index + 1);
      const limit = end < 0 ? sql.length : end + 1;
      result += sql.slice(index, limit);
      index = limit;
      continue;
    }

    if (character === "-" && next === "-") {
      const end = sql.indexOf("\n", index + 2);
      const limit = end < 0 ? sql.length : end;
      result += sql.slice(index, limit);
      index = limit;
      continue;
    }

    if (character === "/" && next === "*") {
      let depth = 1;
      result += "/*";
      index += 2;

      while (index < sql.length && depth > 0) {
        if (sql.startsWith("/*", index)) {
          result += "/*";
          depth += 1;
          index += 2;
        } else if (sql.startsWith("*/", index)) {
          result += "*/";
          depth -= 1;
          index += 2;
        } else {
          result += sql[index];
          index += 1;
        }
      }
      continue;
    }

    if (character === "$") {
      const delimiter = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        const end = sql.indexOf(delimiter, index + delimiter.length);
        const limit = end < 0 ? sql.length : end + delimiter.length;
        result += sql.slice(index, limit);
        index = limit;
        continue;
      }
    }

    if (character === "?") {
      result += `$${++parameter}`;
      index += 1;
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}
