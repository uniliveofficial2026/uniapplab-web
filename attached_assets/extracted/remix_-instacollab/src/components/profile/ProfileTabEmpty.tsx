import type { ComponentType } from 'react';

export function ProfileTabEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="py-20 flex flex-col items-center justify-center text-center px-6">
      <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center mb-6 text-muted-foreground">
        <Icon className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-black mb-2 opacity-80">{title}</h2>
      <p className="text-muted-foreground font-medium max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}
