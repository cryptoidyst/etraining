import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'jdoe',
    description: 'Local username, or an AD username (sAMAccountName), DOMAIN\\user, or user@domain',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  username!: string;

  @ApiProperty({
    example: 'P@ssw0rd!',
    description: 'Account password — never stored in plain text',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
