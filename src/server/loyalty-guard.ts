// SPDX-License-Identifier: Apache-2.0
/**
 * Public-access guard for the auto-generated CRUD routes.
 *
 * Every Prisma model automatically gets an unauthenticated REST surface at
 * `/api/<model>s`. That is fine for throwaway demo tables, but the loyalty
 * tables hold guest phone numbers, points balances and staff PIN hashes —
 * a plain `GET /api/customers` would hand the whole guest list to anyone on
 * the internet.
 *
 * These hook factories reject that surface entirely. All real access goes
 * through the purpose-built routes in `custom-routes.ts`, which resolve a
 * session and return only the slice of data the caller owns.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type HookResult<T = any> = {
  ok: boolean
  error?: { code: string; message: string }
  data?: T
}

const DENIED: HookResult = {
  ok: false,
  error: {
    code: 'forbidden',
    message:
      'This table is not publicly readable. Use the loyalty API (/api/loyalty/* for guests, /api/staff/* for staff).',
  },
}

/**
 * Returns a hook map that rejects every CRUD operation on `modelName`.
 * Drop it into a generated `<model>.hooks.ts` file.
 */
export function denyPublicCrud(modelName: string) {
  const deny = async (): Promise<HookResult> => DENIED
  const denyWithId = async (): Promise<HookResult> => DENIED
  const denyWithInput = async (): Promise<HookResult> => DENIED
  const noop = async (): Promise<void> => {}
  void modelName

  return {
    beforeList: deny,
    beforeGet: denyWithId,
    beforeCreate: denyWithInput,
    beforeUpdate: denyWithId,
    beforeDelete: denyWithId,
    afterCreate: noop,
    afterUpdate: noop,
    afterDelete: noop,
  }
}
