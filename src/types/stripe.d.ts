
// This file teaches TypeScript what the <stripe-pricing-table> custom element is.
// This resolves the "Property does not exist on type JSX.IntrinsicElements" error.
declare namespace JSX {
  interface IntrinsicElements {
    'stripe-pricing-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      'pricing-table-id': string;
      'publishable-key': string;
      'client-reference-id'?: string;
    };
  }
}
