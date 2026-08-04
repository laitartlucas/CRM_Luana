import { Equals } from 'class-validator';

/** Exige que a usuária digite a frase exata na UI antes de apagar todos os clientes/leads — evita clique acidental num endpoint irreversível. */
export class ConfirmWipeDto {
  @Equals('APAGAR TUDO')
  confirmationText!: string;
}
