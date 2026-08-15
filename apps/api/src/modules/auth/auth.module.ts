import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { NotificationsModule } from '../../common/notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorService } from './two-factor.service';
import { WebauthnController } from './webauthn.controller';
import { WebauthnService } from './webauthn.service';

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        // expiresIn comes from env config as a plain string (e.g. "15m"); jsonwebtoken's
        // types want its branded `ms.StringValue` literal type, which a runtime string can't satisfy.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signOptions: { expiresIn: config.get<string>('jwt.accessTtl') as any },
      }),
    }),
  ],
  controllers: [AuthController, WebauthnController],
  providers: [AuthService, JwtStrategy, TwoFactorService, WebauthnService, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
