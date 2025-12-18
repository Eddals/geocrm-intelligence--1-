import { Lead, PipelineStage } from '../types';
import type { FeatureCollection, Feature, Point } from 'geojson';

export type LeadFeatureProps = {
  id: string;
  company?: string;
  name?: string;
  status?: string;
  color: string;
};

const STATUS_COLORS: Record<string, string> = {
  [PipelineStage.NEW]: '#3b82f6',
  [PipelineStage.ANALYSIS]: '#8b5cf6',
  [PipelineStage.CONTACT]: '#f59e0b',
  [PipelineStage.QUALIFIED]: '#a855f7',
  [PipelineStage.WAITING]: '#eab308',
  [PipelineStage.CLOSED]: '#10b981',
  [PipelineStage.LOST]: '#ef4444',
  Quente: '#f97316',
  Morno: '#eab308',
  Frio: '#3b82f6'
};

export const getLeadColor = (lead: Partial<Lead>) => {
  const status = typeof lead.status === 'string' ? lead.status : '';
  return STATUS_COLORS[status] || '#7c3aed';
};

export const getLeadFeatureId = (lead: Partial<Lead>, idx: number) => lead.id || `ghost-${idx}`;

export const leadsToFeatureCollection = (leads: Partial<Lead>[]): FeatureCollection<Point, LeadFeatureProps> => {
  const features: Feature<Point, LeadFeatureProps>[] = [];

  leads.forEach((lead, idx) => {
    const lat = Number(lead.lat);
    const lng = Number(lead.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const id = getLeadFeatureId(lead, idx);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: {
        id,
        company: lead.company,
        name: lead.name,
        status: lead.status,
        color: getLeadColor(lead)
      }
    });
  });

  return { type: 'FeatureCollection', features };
};
