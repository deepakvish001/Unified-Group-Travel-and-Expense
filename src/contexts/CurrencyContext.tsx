import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5',
  INR: '\u20B9', AUD: 'A$', CAD: 'C$', CHF: 'CHF', CNY: '\u00A5',
  KRW: '\u20A9', BRL: 'R$', MXN: 'MX$', SGD: 'S$', SEK: 'kr',
  NZD: 'NZ$', THB: '\u0E3F', AED: 'AED', ZAR: 'R',
};

type CurrencyContextType = {
  currency: string;
  setCurrency: (c: string) => void;
  symbol: string;
  format: (amount: number, overrideCurrency?: string) => string;
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  setCurrency: () => {},
  symbol: '$',
  format: (n) => `$${n.toLocaleString()}`,
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code + ' ';
}

export function formatCurrencyGlobal(amount: number, currency: string): string {
  const sym = getCurrencySymbol(currency);
  return `${sym}${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState(() => {
    return localStorage.getItem('wayfare-currency') || 'USD';
  });

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    localStorage.setItem('wayfare-currency', c);
  };

  useEffect(() => {
    localStorage.setItem('wayfare-currency', currency);
  }, [currency]);

  const symbol = getCurrencySymbol(currency);

  const format = (amount: number, overrideCurrency?: string) => {
    const c = overrideCurrency ?? currency;
    const s = getCurrencySymbol(c);
    return `${s}${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, symbol, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}
