import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
