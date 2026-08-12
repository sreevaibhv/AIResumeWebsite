import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScanModule } from "./scan/scan.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScanModule,
    AuthModule,
  ],
})
export class AppModule {}
