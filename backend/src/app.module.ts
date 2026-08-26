import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScanModule } from "./scan/scan.module";
import { AuthModule } from "./auth/auth.module";
import { ResumesModule } from "./resumes/resumes.module";
import { ExtractionModule } from "./extraction/extraction.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScanModule,
    AuthModule,
    ResumesModule,
    ExtractionModule,
  ],
})
export class AppModule {}
