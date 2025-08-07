import { resolveTokenAliases } from './design-tokens';

export interface UINode {
  id?: string;
  component?: string;
  layout?: 'VerticalStack' | 'HorizontalStack' | 'Grid';
  props?: Record<string, any>;
  children?: UINode[];
  visibleWhen?: string;
  repeaterFor?: string;
  render?: UINode;
}

export interface UIStateDocument {
  $schema: string;
  version: string;
  designTokens: string[];
  componentManifest: string;
  dataSchema: object;
  data: any;
  uiTree: UINode;
}

// JSONPath-like data binding resolver
export function resolveDataBinding(path: string, data: any): any {
  if (!path.startsWith('$.')) {
    return path;
  }
  
  const pathParts = path.slice(2).split('.');
  let current = data;
  
  for (const part of pathParts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

// Resolve all bindings in a props object
export function resolveProps(props: Record<string, any>, data: any): Record<string, any> {
  const resolved: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      // Check for token binding
      if (value.startsWith('{') && value.endsWith('}')) {
        resolved[key] = resolveTokenAliases(value);
      }
      // Check for data binding
      else if (value.startsWith('$.')) {
        resolved[key] = resolveDataBinding(value, data);
      }
      else {
        resolved[key] = value;
      }
    } else {
      resolved[key] = value;
    }
  }
  
  return resolved;
}

// Evaluate visibility conditions
export function evaluateVisibility(condition: string, data: any): boolean {
  if (!condition) return true;
  
  // Simple condition evaluation (can be extended)
  // Example: "$.ui.isLoading === false"
  try {
    // Replace data bindings with actual values
    let evaluatedCondition = condition;
    const dataBindings = condition.match(/\$\.[a-zA-Z0-9.]+/g) || [];
    
    for (const binding of dataBindings) {
      const value = resolveDataBinding(binding, data);
      evaluatedCondition = evaluatedCondition.replace(binding, JSON.stringify(value));
    }
    
    // Use Function constructor for safe evaluation (in a real app, use a proper expression evaluator)
    return new Function('return ' + evaluatedCondition)();
  } catch (error) {
    console.warn('Error evaluating visibility condition:', condition, error);
    return true;
  }
}

// Process repeater logic
export function processRepeater(node: UINode, data: any): UINode[] {
  if (!node.repeaterFor || !node.render) {
    return [];
  }
  
  const arrayData = resolveDataBinding(node.repeaterFor, data);
  if (!Array.isArray(arrayData)) {
    console.warn('Repeater data is not an array:', node.repeaterFor);
    return [];
  }
  
  return arrayData.map((item, index) => {
    // Create a new data context with the current item
    const itemData = {
      ...data,
      $item: item,
      $index: index,
    };
    
    // Clone the render template and process it with the item data
    return {
      ...node.render,
      id: `${node.render.id || 'item'}-${index}`,
      props: node.render.props ? resolveProps(node.render.props, itemData) : undefined,
    };
  });
}

// Main UI tree processor
export function processUINode(node: UINode, data: any): UINode | null {
  // Check visibility
  if (node.visibleWhen && !evaluateVisibility(node.visibleWhen, data)) {
    return null;
  }
  
  // Handle repeaters
  if (node.repeaterFor) {
    const repeatedNodes = processRepeater(node, data);
    return {
      layout: 'VerticalStack',
      children: repeatedNodes.map(childNode => processUINode(childNode, data)).filter(Boolean) as UINode[],
    };
  }
  
  // Process regular node
  const processedNode: UINode = {
    ...node,
    props: node.props ? resolveProps(node.props, data) : undefined,
  };
  
  // Process children
  if (node.children) {
    processedNode.children = node.children
      .map(child => processUINode(child, data))
      .filter(Boolean) as UINode[];
  }
  
  return processedNode;
}

// Validate component props against argTypes (placeholder for now)
export function validateComponentProps(component: string, props: Record<string, any>, argTypes: any): boolean {
  // This would validate against the actual Storybook argTypes
  // For now, just return true
  console.log(`Validating ${component} props:`, props, 'against argTypes:', argTypes);
  return true;
}