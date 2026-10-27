export type PluralCategory = Intl.LDMLPluralRule;

export type PluralRuleHandler<TArgs extends unknown[] = []> = (count: number, ...args: TArgs) => string;

export type PluralForms<TArgs extends unknown[] = []> = Partial<Record<Intl.LDMLPluralRule, PluralRuleHandler<TArgs>>> & {
  other: PluralRuleHandler<TArgs>;
};

export interface PluralFormatter<TArgs extends unknown[] = []> {
  (count?: number, ...args: TArgs): string;
  toString(): string;
  category(count: number): Intl.LDMLPluralRule;
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();

/**
 * Returns a cached Intl.PluralRules instance for the specified locale and options.
 */
export function getPluralRules(locale: string, options?: Intl.PluralRulesOptions): Intl.PluralRules {
  const key = `${locale}:${options?.type ?? "cardinal"}`;
  let pr = pluralRulesCache.get(key);
  if (!pr) {
    pr = new Intl.PluralRules(locale, options);
    pluralRulesCache.set(key, pr);
  }
  return pr;
}

/**
 * Selects the LDML plural category ('zero' | 'one' | 'two' | 'few' | 'many' | 'other')
 * for a given count in the specified locale using ECMAScript Intl.PluralRules.
 */
export function selectPluralCategory(
  locale: string,
  count: number,
  options?: Intl.PluralRulesOptions,
): Intl.LDMLPluralRule {
  return getPluralRules(locale, options).select(count);
}

/**
 * Creates a plural-aware message formatter backed by Intl.PluralRules.
 * When called with a number, selects the matching category and executes its handler.
 * Provides backward compatibility by exposing .toString() so template literals or
 * legacy property reads return the fallback string smoothly.
 */
export function createPluralMessage<TArgs extends unknown[] = []>(
  locale: string,
  forms: PluralForms<TArgs>,
  legacyFallback?: string,
): PluralFormatter<TArgs> {
  const formatter = ((count: number = 1, ...args: TArgs): string => {
    const category = selectPluralCategory(locale, count);
    const handler = forms[category] ?? forms.other;
    return handler(count, ...args);
  }) as PluralFormatter<TArgs>;

  formatter.category = (count: number) => selectPluralCategory(locale, count);
  formatter.toString = () => legacyFallback ?? (formatter as unknown as (count: number) => string)(1);

  return formatter;
}
