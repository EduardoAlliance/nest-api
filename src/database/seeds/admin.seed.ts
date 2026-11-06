import { DataSource } from 'typeorm';
import { User, UserRole } from '../../modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

export async function runAdminSeed(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);

  const existingAdmin = await userRepository.findOne({
    where: { email: 'admin@example.com' },
    withDeleted: true,
  });

  if (existingAdmin) {
    console.log('Admin user already exists, skipping seed.');
    return;
  }

  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  const admin = userRepository.create({
    email: 'admin@example.com',
    name: 'Administrator',
    password: hashedPassword,
    role: UserRole.ADMIN,
    isActive: true,
    emailVerified: true,
    phone: '+525500000000',
  } as any);

  await userRepository.save(admin);
  console.log('Admin user created: admin@example.com / Admin123!');
}
