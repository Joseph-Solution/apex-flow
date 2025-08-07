import primitiveTokens from '../../design-system/tokens/primitive.json';
import semanticTokens from '../../design-system/tokens/semantic.json';
import componentTokens from '../../design-system/tokens/component.json';

export type DesignToken = {
  $value: string;
  $type: string;
};

export type TokenMap = Record<string, any>;

// Flatten nested token objects into dot notation paths
function flattenTokens(obj: any, prefix = ''): Record<string, DesignToken> {
  const result: Record<string, DesignToken> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue; // Skip schema properties
    
    const path = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && '$value' in value && '$type' in value) {
      result[path] = value as DesignToken;
    } else if (value && typeof value === 'object') {
      Object.assign(result, flattenTokens(value, path));
    }
  }
  
  return result;
}

// Resolve token aliases (e.g., "{color.primitive.blue.500}" -> "#3b82f6")
function resolveTokenValue(value: string, tokenMap: Record<string, DesignToken>): string {
  if (!value.startsWith('{') || !value.endsWith('}')) {
    return value;
  }
  
  const tokenPath = value.slice(1, -1); // Remove { and }
  const token = tokenMap[tokenPath];
  
  if (!token) {
    console.warn(`Token not found: ${tokenPath}`);
    return value;
  }
  
  // Recursively resolve if the token value is also an alias
  return resolveTokenValue(token.$value, tokenMap);
}

// Create a flattened map of all tokens
const allTokens = {
  ...flattenTokens(primitiveTokens),
  ...flattenTokens(semanticTokens),
  ...flattenTokens(componentTokens),
};

// Resolve all token aliases
const resolvedTokens: Record<string, string> = {};
for (const [path, token] of Object.entries(allTokens)) {
  resolvedTokens[path] = resolveTokenValue(token.$value, allTokens);
}

export { resolvedTokens };

// Helper function to get a resolved token value
export function getToken(path: string): string {
  const value = resolvedTokens[path];
  if (!value) {
    console.warn(`Token not found: ${path}`);
    return path; // Return the path as fallback
  }
  return value;
}

// Helper function to resolve token aliases in any string
export function resolveTokenAliases(value: string): string {
  return resolveTokenValue(value, allTokens);
}

// Export token categories for easier access
export const tokens = {
  color: {
    background: {
      primary: getToken('color.background.primary'),
      secondary: getToken('color.background.secondary'),
      interactive: getToken('color.background.interactive'),
      interactiveHover: getToken('color.background.interactive-hover'),
      success: getToken('color.background.success'),
      danger: getToken('color.background.danger'),
      card: getToken('color.background.card'),
    },
    text: {
      primary: getToken('color.text.primary'),
      secondary: getToken('color.text.secondary'),
      muted: getToken('color.text.muted'),
      inverse: getToken('color.text.inverse'),
      interactive: getToken('color.text.interactive'),
      success: getToken('color.text.success'),
      danger: getToken('color.text.danger'),
    },
    border: {
      default: getToken('color.border.default'),
      interactive: getToken('color.border.interactive'),
      focus: getToken('color.border.focus'),
      success: getToken('color.border.success'),
      danger: getToken('color.border.danger'),
    },
  },
  spacing: {
    component: {
      xs: getToken('spacing.component.xs'),
      sm: getToken('spacing.component.sm'),
      md: getToken('spacing.component.md'),
      lg: getToken('spacing.component.lg'),
      xl: getToken('spacing.component.xl'),
    },
    layout: {
      xs: getToken('spacing.layout.xs'),
      sm: getToken('spacing.layout.sm'),
      md: getToken('spacing.layout.md'),
      lg: getToken('spacing.layout.lg'),
      xl: getToken('spacing.layout.xl'),
    },
  },
  typography: {
    heading: {
      large: getToken('typography.heading.large'),
      medium: getToken('typography.heading.medium'),
      small: getToken('typography.heading.small'),
    },
    body: {
      large: getToken('typography.body.large'),
      medium: getToken('typography.body.medium'),
      small: getToken('typography.body.small'),
    },
    caption: getToken('typography.caption'),
  },
  borderRadius: {
    interactive: getToken('borderRadius.interactive'),
    card: getToken('borderRadius.card'),
    input: getToken('borderRadius.input'),
  },
};