import React from 'react';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';

type Props = {
  className?: string;
  as?: 'span' | 'p' | 'h1' | 'h2';
  children?: React.ReactNode;
};

/**
 * UniLive’s wordmark text. Official spelling only — never invent alternate names.
 * Does not change layout beyond the caller's className.
 */
export function UniLivesWordmark({
  className,
  as: Tag = 'span',
  children,
}: Props) {
  return <Tag className={className}>{children ?? APP_DISPLAY_NAME}</Tag>;
}
