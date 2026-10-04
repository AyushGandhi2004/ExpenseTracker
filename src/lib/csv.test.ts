import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("Food")).toBe("Food");
    expect(csvCell(249.5)).toBe("249.5");
    expect(csvCell(-50)).toBe("-50");
    expect(csvCell(null)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Fries, Peri Peri")).toBe('"Fries, Peri Peri"');
    expect(csvCell('the "good" one')).toBe('"the ""good"" one"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+91 phone")).toBe("'+91 phone");
    expect(csvCell("-refund")).toBe("'-refund");
    expect(csvCell("@sum")).toBe("'@sum");
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and ends with a newline", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});
