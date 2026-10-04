import bcrypt from 'bcryptjs';

const ROUNDS = 12;

// Hash válido y descartable para igualar el tiempo de respuesta cuando el usuario no existe.
export const DUMMY_HASH = bcrypt.hashSync('barberflow-dummy-password', ROUNDS);

export async function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
