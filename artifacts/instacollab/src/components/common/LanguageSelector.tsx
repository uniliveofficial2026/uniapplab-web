import React from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Chinese',
  'Portuguese',
  'Russian',
  'Arabic'
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function LanguageSelector({ value, onChange }: Props) {
  return (
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        <Globe className="w-4 h-4" />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 bg-secondary/50 rounded-xl border border-border pl-12 pr-4 appearance-none focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer font-medium"
      >
        {LANGUAGES.map(lang => (
          <option key={lang} value={lang}>{lang}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
