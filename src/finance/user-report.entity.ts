import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'user_reports' })
export class UserReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 120 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'ai_triage', type: 'text', nullable: true })
  aiTriage: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
