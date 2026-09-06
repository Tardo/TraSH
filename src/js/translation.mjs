// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

export type TranslationValues = {[string]: mixed};
export type Translator = (key: string, fallback: string, values?: TranslationValues) => string;

function defaultTranslator(_key: string, fallback: string, values?: TranslationValues): string {
  return fallback.replace(/{{\s*([^}]+?)\s*}}/g, (placeholder, name) => {
    const value = values?.[name];
    return typeof value === 'undefined' ? placeholder : String(value);
  });
}

let translator: Translator = defaultTranslator;

export function translate(key: string, fallback: string = key, values?: TranslationValues): string {
  return translator(key, fallback, values);
}

export function setTranslator(nextTranslator?: Translator): void {
  translator = nextTranslator || defaultTranslator;
}

export {translate as t};
