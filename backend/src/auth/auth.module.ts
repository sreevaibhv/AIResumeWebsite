import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { GoogleStrategy } from "./google.strategy";
import { PrismaService } from "../common/prisma.service";

const providers: any[] = [AuthService, PrismaService, JwtStrategy];

// Only wire Google SSO if credentials are actually configured — otherwise
// passport-google-oauth20's strategy constructor throws at boot.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleStrategy);
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({ secret: process.env.JWT_SECRET ?? "change-me" }),
  ],
  controllers: [AuthController],
  providers,
})
export class AuthModule {}
