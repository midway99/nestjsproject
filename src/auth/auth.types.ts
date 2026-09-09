export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  lastName: string | null;
  role: UserRole;
}
