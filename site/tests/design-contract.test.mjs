import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function rootSection(css, start, end) {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(root, "expected the global :root token block");
  const section = end
    ? root.match(new RegExp(`${escapeRegExp(start)}([\\s\\S]*?)${escapeRegExp(end)}`))?.[1]
    : root.slice(root.indexOf(start) + start.length);
  assert.ok(section, `expected token section ${start}`);
  return section;
}

function cssToken(block, name) {
  const value = block.match(new RegExp(`--${escapeRegExp(name)}:\\s*([^;]+);`))?.[1]?.trim();
  assert.ok(value, `expected CSS token --${name}`);
  return value;
}

function yamlSection(frontmatter, name) {
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line === `${name}:`);
  assert.notEqual(start, -1, `expected DESIGN.md section ${name}`);
  const sectionLines = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line)) break;
    sectionLines.push(line);
  }
  return sectionLines.join("\n");
}

function yamlValue(section, name) {
  const value = section.match(new RegExp(`^\\s{2}${escapeRegExp(name)}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, "m"))?.[1];
  assert.ok(value, `expected DESIGN.md value ${name}`);
  return value;
}

function yamlNestedValue(frontmatter, sectionName, objectName, propertyName) {
  const section = yamlSection(frontmatter, sectionName);
  const lines = section.split("\n");
  const objectStart = lines.findIndex((line) => line === `  ${objectName}:`);
  assert.notEqual(objectStart, -1, `expected DESIGN.md object ${sectionName}.${objectName}`);
  const objectLines = [];
  for (const line of lines.slice(objectStart + 1)) {
    if (line && /^\s{2}\S/.test(line)) break;
    objectLines.push(line);
  }
  const value = objectLines.join("\n").match(new RegExp(`^\\s{4}${escapeRegExp(propertyName)}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, "m"))?.[1];
  assert.ok(value, `expected DESIGN.md value ${sectionName}.${objectName}.${propertyName}`);
  return value;
}

const [css, design, sidecarText] = await Promise.all([
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../../DESIGN.md", import.meta.url), "utf8"),
  readFile(new URL("../../.impeccable/design.json", import.meta.url), "utf8"),
]);

const frontmatter = design.match(/^---\n([\s\S]*?)\n---/)?.[1];
assert.ok(frontmatter, "expected DESIGN.md YAML frontmatter");
const sidecar = JSON.parse(sidecarText);
const primitiveTokens = rootSection(css, "/* Primitive tokens:", "/* Semantic tokens:");
const semanticTokens = rootSection(css, "/* Semantic tokens:", "/* Component tokens:");
const componentTokens = rootSection(css, "/* Component tokens:", "");

test("design artifacts stay aligned with the CSS contract", () => {
  const breakpoints = Object.fromEntries(sidecar.extensions.breakpoints.map(({ name, value }) => [name, value]));
  assert.equal(cssToken(primitiveTokens, "breakpoint-tablet"), "1040px");
  assert.equal(cssToken(primitiveTokens, "breakpoint-mobile"), "834px");
  assert.match(css, /@media \(max-width: 1040px\)/);
  assert.match(css, /@media \(max-width: 834px\)/);
  assert.equal(breakpoints.tablet, "1040px");
  assert.equal(breakpoints.mobile, "834px");
  assert.match(design, /tablet breakpoint \(`1040px`\)/);
  assert.match(design, /mobile breakpoint \(`834px`\)/);

  const heights = {
    sm: "30px",
    md: "34px",
    touch: "44px",
  };
  for (const [name, value] of Object.entries(heights)) {
    assert.equal(cssToken(primitiveTokens, `control-height-${name}`), value);
    assert.match(design, new RegExp(`\\b${escapeRegExp(value)}\\b`));
  }
  const buttonSnippets = sidecar.components.filter(({ refersTo }) => ["button-primary", "button-accent"].includes(refersTo));
  assert.equal(buttonSnippets.length, 2);
  for (const component of buttonSnippets) assert.match(component.css, /var\(--component-control-height\)/);

  const radii = {
    sm: "6px",
    md: "8px",
    lg: "12px",
  };
  for (const [name, value] of Object.entries(radii)) {
    assert.equal(cssToken(primitiveTokens, `radius-${name}`), value);
    assert.equal(yamlValue(yamlSection(frontmatter, "rounded"), name), value);
  }
  assert.match(sidecar.components.find(({ refersTo }) => refersTo === "button-primary")?.css ?? "", /var\(--component-control-radius\)/);
  assert.match(sidecar.components.find(({ refersTo }) => refersTo === "surface-panel")?.css ?? "", /var\(--component-surface-radius\)/);

  const spacing = {
    1: "4px",
    2: "6px",
    3: "8px",
    4: "12px",
    5: "16px",
    6: "24px",
    7: "32px",
    "control-compact": "9px",
    "control-inline": "11px",
    "control-touch": "13px",
  };
  const spacingSection = yamlSection(frontmatter, "spacing");
  for (const [name, value] of Object.entries(spacing)) {
    assert.equal(cssToken(primitiveTokens, `space-${name}`), value);
    assert.equal(yamlValue(spacingSection, name), value);
  }
  assert.doesNotMatch(css, /gap:\s*10px/);
  assert.doesNotMatch(css, /(?:gap|padding(?:-(?:inline|block|top|right|bottom|left))?):[^;]*(?:10|14|20)px/);
  assert.match(componentTokens, /--component-control-padding-inline:\s*var\(--space-control-inline\)/);
  assert.match(componentTokens, /--component-compact-padding-inline:\s*var\(--space-control-compact\)/);
  assert.match(componentTokens, /--component-touch-padding-inline:\s*var\(--space-control-touch\)/);
  assert.match(componentTokens, /--component-input-padding-inline:\s*var\(--space-control-compact\)/);
  assert.match(componentTokens, /--component-modal-padding:\s*calc\(var\(--space-5\) \+ var\(--space-1\)\)/);

  assert.equal(cssToken(primitiveTokens, "font-size-lg"), "16px");
  assert.equal(cssToken(primitiveTokens, "font-weight-bold"), "700");
  assert.equal(yamlNestedValue(frontmatter, "typography", "title", "fontSize"), "16px");
  assert.equal(yamlNestedValue(frontmatter, "typography", "title", "fontWeight"), "700");
  assert.match(css, /\.brandText\s*\{[^}]*font-weight:\s*var\(--font-weight-bold\)/s);
  assert.match(css, /\.modalHeader h3\s*\{[^}]*font-weight:\s*var\(--font-weight-bold\)/s);
  const titleSnippets = sidecar.components.filter(({ refersTo }) => refersTo === "title");
  assert.equal(titleSnippets.length, 2);
  for (const component of titleSnippets) {
    assert.match(component.css, /var\(--font-weight-bold\)/);
    assert.match(component.css, /var\(--font-size-lg\)/);
  }

  assert.doesNotMatch(semanticTokens, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(semanticTokens, /\brgba?\(/i);
  assert.doesNotMatch(componentTokens, /--component-[^:]+:\s*(?:9|11|13)px\b/);
});
