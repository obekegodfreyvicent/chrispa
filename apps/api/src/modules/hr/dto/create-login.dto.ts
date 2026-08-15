import { IsEmail, IsIn } from 'class-validator';

// CUSTOMER is deliberately excluded — this grants a *staff* system login,
// not a storefront account (customers register themselves at /auth/register).
export const STAFF_ROLES = ['OWNER', 'STORE_MANAGER', 'FULFILLMENT', 'SUPPORT_AGENT', 'HR_MANAGER'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export class CreateLoginDto {
  @IsEmail()
  email: string;

  @IsIn(STAFF_ROLES)
  role: StaffRole;
}
