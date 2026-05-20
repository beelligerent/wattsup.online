'use client';
import React from 'react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';

interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  taglineClassName?: string;
  showText?: boolean;
  showTagline?: boolean;
  isDarkMode?: boolean;
  collapsed?: boolean;
  isAnimated?: boolean;
  gap?: string;
}

// Default WattsUp brand icon — orange bolt matching the provided branding image.
// Used as fallback when no custom logo has been uploaded in Settings.
export const DefaultBrandIcon: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn(
    "rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shrink-0",
    className
  )}>
    <svg viewBox="0 0 24 24" fill="none" className="w-[58%] h-[58%]">
      <path d="M13 2L4.5 13H11L10 22L20.5 10H14L13 2Z" fill="white" strokeLinejoin="round" />
    </svg>
  </div>
);

export const Logo: React.FC<LogoProps> = ({
  className,
  iconClassName,
  textClassName,
  taglineClassName,
  showText = true,
  showTagline = true,
  isDarkMode = false,
  collapsed = false,
  isAnimated = false,
  gap = 'gap-2',
}) => {
  const { generalSettings } = useStore();
  const logoUrl = generalSettings?.logoUrl;

  const renderIcon = () => {
    // If admin has uploaded a custom logo, use it everywhere
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt="WattsUp Logo"
          className={cn(
            'object-contain transition-all duration-300',
            collapsed ? 'h-9 w-9' : 'h-10 w-auto max-w-[120px]',
            iconClassName
          )}
          referrerPolicy="no-referrer"
        />
      );
    }

    // Default brand icon
    return (
      <DefaultBrandIcon
        className={cn(
          'w-10 h-10',
          iconClassName
        )}
      />
    );
  };

  return (
    <div className={cn('flex items-center', gap, className)}>
      {renderIcon()}
      {!collapsed && (showText || showTagline) && (
        <div className="flex flex-col">
          {showText && (
            <h1 className={cn(
              'font-black text-xl leading-none tracking-tight whitespace-nowrap',
              isDarkMode ? 'text-white' : 'text-slate-900',
              textClassName
            )}>
              WattsUp
            </h1>
          )}
          {showTagline && (
            <p className={cn(
              'text-[10px] uppercase tracking-[0.22em] font-bold whitespace-nowrap opacity-60',
              isDarkMode ? 'text-white' : 'text-slate-700',
              taglineClassName
            )}>
              Energy Intelligence
            </p>
          )}
        </div>
      )}
    </div>
  );
};
