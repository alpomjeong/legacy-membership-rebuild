import { Prisma } from '@prisma/client';
import {
  buildModelPlans,
  type DmmfDatamodel,
  type ModelPlan,
} from './backup-models';
import type { FieldTypes } from './backup-codec';

/** 실제 Prisma 스키마(DMMF)로부터 백업 대상 테이블 계획을 만든다. */
export function getModelPlans(): ModelPlan[] {
  return buildModelPlans(Prisma.dmmf.datamodel as unknown as DmmfDatamodel);
}

/** audit_log 델리게이트의 스칼라 필드 타입 맵(델타 저널 인코딩용). */
export function auditFieldTypes(plans: ModelPlan[]): FieldTypes {
  return plans.find((p) => p.delegate === 'auditLog')?.fieldTypes ?? {};
}
