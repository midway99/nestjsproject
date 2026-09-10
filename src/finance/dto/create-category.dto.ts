import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { TransactionType } from '../transaction-type.enum.js';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsEnum(TransactionType)
  type: TransactionType;
}
