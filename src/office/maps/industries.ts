import type { RoomRole } from './themes.js';

/** Industry template — relabels room roles so the same map geometry reads
 *  as a different kind of company. Pure data, no geometry changes. */
export type IndustryTemplate = {
  id: string;
  label: string;
  roleLabels: Partial<Record<RoomRole, string>>;
};

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'software',
    label: 'Software Company',
    roleLabels: {}, // uses each map's default labels
  },
  {
    id: 'agency',
    label: 'Creative Agency',
    roleLabels: {
      product: 'Account & Strategy',
      engineering: 'Web & Dev',
      design: 'Art Direction',
      marketing: 'Campaigns',
      support: 'Client Services',
      hr: 'Studio Ops',
      data: 'Analytics',
      content: 'Content Studio',
      server: 'Archive / Render',
    },
  },
  {
    id: 'ecommerce',
    label: 'E-commerce',
    roleLabels: {
      product: 'Merchandising',
      engineering: 'Platform & Tech',
      design: 'Brand & Creative',
      marketing: 'Growth & Ads',
      support: 'Customer Care',
      hr: 'Finance & Admin',
      data: 'Ops & Fulfillment',
      content: 'Product Photos',
      server: 'Warehouse Sync',
    },
  },
  {
    id: 'gamestudio',
    label: 'Game Studio',
    roleLabels: {
      product: 'Game Design',
      engineering: 'Programming',
      design: 'Art & Animation',
      marketing: 'Community',
      support: 'Player Support',
      hr: 'Production',
      data: 'QA & Playtest',
      content: 'Audio / Capture',
      server: 'Build Farm',
    },
  },
];

export function getIndustry(id: string): IndustryTemplate {
  return INDUSTRY_TEMPLATES.find((industry) => industry.id === id) ?? INDUSTRY_TEMPLATES[0];
}
