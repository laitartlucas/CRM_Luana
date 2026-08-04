import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  identifier!: string;

  // Sem MinLength aqui de propósito: essa validação é sobre o que já está
  // salvo (login), não sobre política de senha nova — isso fica no
  // CreateUserDto. Um MinLength alto aqui bloquearia contas legítimas com
  // senha mais curta.
  @IsString()
  @IsNotEmpty()
  password!: string;
}
