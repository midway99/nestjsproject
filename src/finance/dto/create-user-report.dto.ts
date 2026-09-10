import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserReportDto {
  @IsString({ message: 'Тема репорта должна быть строкой' })
  @MinLength(3, { message: 'Тема репорта должна быть не короче 3 символов' })
  @MaxLength(120, {
    message: 'Тема репорта должна быть не длиннее 120 символов',
  })
  subject: string;

  @IsString({ message: 'Описание репорта должно быть строкой' })
  @MinLength(10, {
    message: 'Описание репорта должно быть не короче 10 символов',
  })
  @MaxLength(3000, {
    message: 'Описание репорта должно быть не длиннее 3000 символов',
  })
  message: string;
}
