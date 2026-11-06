import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { UsersService } from '../../modules/users/users.service';
import { LoggerService } from '../../logging/logger.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const logger = app.get(LoggerService);

  try {
    const adminUser = await usersService.findByEmail('admin@example.com');
    if (adminUser) {
      logger.log('El usuario admin ya existe, omitiendo seeder');
    } else {
      await usersService.create({
        email: 'admin@example.com',
        name: 'Admin',
        password: 'Admin123!',
        role: 'admin' as any,
        isActive: true,
      });
      logger.log('Usuario admin creado exitosamente: admin@example.com / Admin123!');
    }
  } catch (error) {
    logger.error('Error ejecutando seeder:', error.message);
  } finally {
    await app.close();
  }
}

seed();
