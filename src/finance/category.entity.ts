import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TransactionType } from './transaction-type.enum.js';

@Entity({ name: 'expense_categories' })
@Unique(['userId', 'type', 'name'])
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 50 })
  name: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: TransactionType.EXPENSE,
  })
  type: TransactionType;
}
