import { IsNotEmpty, IsString } from 'class-validator';

export class ImportRespondiDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o link da resposta do Respondi.' })
  url!: string;
}
