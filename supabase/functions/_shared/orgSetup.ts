// Onboarding a real customer: a new organisation and its first manager. Run by the project owner with the service-role key
// (scripts/create-org.mjs); there is deliberately no public sign-up.
import type { Db } from './clients.ts';
import { createStaff, type StaffFailure } from './staff.ts';

export const ORG_TYPES = ['processor', 'fpo', 'aggregator', 'exporter'] as const;
export interface NewOrganization { orgName: string; orgType: string; managerName: string; managerEmail: string }
export type OrgOutcome = { ok: true; orgId: string; userId: string; tempPassword: string } | StaffFailure;

export async function createOrganization(db: Db, raw: NewOrganization): Promise<OrgOutcome> {
  const orgName = String(raw.orgName ?? '').trim().replace(/\s+/g, ' ');
  if (orgName.length < 2 || orgName.length > 80) return { ok: false, status: 400, code: 'invalid', error: 'Organisation name must be 2 to 80 characters.' };
  if (!(ORG_TYPES as readonly string[]).includes(raw.orgType)) return { ok: false, status: 400, code: 'invalid', error: `Type must be one of: ${ORG_TYPES.join(', ')}.` };
  const orgId = crypto.randomUUID();
  const org = await db.from('organizations').insert({ id: orgId, name: orgName, type: raw.orgType, is_demo: false });
  if (org.error) return { ok: false, status: 500, code: 'org_failed', error: 'Could not create the organisation.' };
  const mgr = await createStaff(db, orgId, { name: raw.managerName, email: raw.managerEmail, role: 'manager', language: 'en' });
  if (!mgr.ok) { await db.from('organizations').delete().eq('id', orgId); return mgr; }
  return { ok: true, orgId, userId: mgr.userId, tempPassword: mgr.tempPassword };
}
