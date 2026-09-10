import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'ai_analysis_reports' })
export class AnalysisReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  analysis: string;

  @Column({ name: 'summary', type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'recommendations', type: 'simple-json', nullable: true })
  recommendations: string[] | null;

  @Column({ name: 'snapshot', type: 'simple-json', nullable: true })
  snapshot: Record<string, unknown> | null;

  @Column({ name: 'model', type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: string | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd: string | null;

  @Column({ name: 'expense_count', type: 'integer' })
  expenseCount: number;

  @Column({
    name: 'total_expenses',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  totalExpenses: number;

  @Column({
    name: 'total_income',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  totalIncome: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  balance: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
