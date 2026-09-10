import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  message: string;
}
