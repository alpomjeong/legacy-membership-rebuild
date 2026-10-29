import { buildModelPlans, type DmmfDatamodel } from './backup-models';

const fake: DmmfDatamodel = {
  models: [
    {
      name: 'AuditLog',
      dbName: 'audit_log',
      fields: [
        { name: 'id', kind: 'scalar', type: 'BigInt' },
        { name: 'beforeJson', kind: 'scalar', type: 'Json' },
        {
          name: 'member',
          kind: 'object',
          type: 'Member',
          relationName: 'AuditToMember',
        },
      ],
    },
    {
      name: 'Member',
      dbName: 'member',
      fields: [
        { name: 'id', kind: 'scalar', type: 'BigInt' },
        { name: 'status', kind: 'enum', type: 'MemberStatus' },
        {
          name: 'regs',
          kind: 'object',
          type: 'Reg',
          relationName: 'MemberToReg',
        },
      ],
    },
  ],
};

describe('buildModelPlans', () => {
  it('creates one plan per model with camelCase delegate and dbName', () => {
    const plans = buildModelPlans(fake);
    expect(plans.map((p) => p.model)).toEqual(['AuditLog', 'Member']);
    expect(plans[0].delegate).toBe('auditLog');
    expect(plans[0].dbName).toBe('audit_log');
  });

  it('keeps scalar+enum fields, drops relation (object) fields', () => {
    const plans = buildModelPlans(fake);
    expect(plans[0].fieldTypes).toEqual({ id: 'BigInt', beforeJson: 'Json' });
    expect(plans[1].fieldTypes).toEqual({
      id: 'BigInt',
      status: 'MemberStatus',
    });
    expect(plans[1].fieldTypes.regs).toBeUndefined();
  });

  it('falls back to model name when dbName is null', () => {
    const plans = buildModelPlans({
      models: [
        {
          name: 'Tenant',
          dbName: null,
          fields: [{ name: 'id', kind: 'scalar', type: 'BigInt' }],
        },
      ],
    });
    expect(plans[0].dbName).toBe('Tenant');
  });
});
