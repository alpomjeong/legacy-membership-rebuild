import type { FieldTypes } from './backup-codec';

export const MODEL_PLANS = Symbol('MODEL_PLANS');

/** Prisma DMMF 에서 우리가 쓰는 최소 부분만 추린 형태(테스트 용이성 위해 좁게 정의). */
export interface DmmfField {
  name: string;
  kind: 'scalar' | 'object' | 'enum' | 'unsupported';
  type: string;
  relationName?: string;
}
export interface DmmfModel {
  name: string;
  dbName: string | null;
  fields: DmmfField[];
}
export interface DmmfDatamodel {
  models: DmmfModel[];
}

export interface ModelPlan {
  /** PascalCase 모델명 (예: 'AuditLog') */
  model: string;
  /** PrismaClient 델리게이트 키 (예: 'auditLog') */
  delegate: string;
  /** 물리 테이블명 (예: 'audit_log') */
  dbName: string;
  /** 스칼라/enum 필드만: 필드명 → Prisma 타입 */
  fieldTypes: FieldTypes;
}

const lowerFirst = (s: string): string =>
  s ? s[0].toLowerCase() + s.slice(1) : s;

/**
 * DMMF 데이터모델을 백업/복원이 순회할 수 있는 테이블 계획 목록으로 변환한다.
 * 관계(object) 필드는 제외 — 스칼라 FK 컬럼만 남아 findMany(무 include) 결과와 일치.
 */
export function buildModelPlans(datamodel: DmmfDatamodel): ModelPlan[] {
  return datamodel.models.map((m) => {
    const fieldTypes: FieldTypes = {};
    for (const f of m.fields) {
      if (f.kind === 'object' || f.relationName) continue; // 관계 필드 제외
      fieldTypes[f.name] = f.type;
    }
    return {
      model: m.name,
      delegate: lowerFirst(m.name),
      dbName: m.dbName ?? m.name,
      fieldTypes,
    };
  });
}
