import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredName?: string;

  // '' is a deliberate "clear the avatar" signal from the client (see
  // ProfileService.updateProfile) — everything else must be a real URL.
  @IsOptional()
  @ValidateIf((_o, value) => value !== '')
  @IsUrl()
  avatarUrl?: string;

  // Full-replace, same convention as admin product wellness tags — the
  // client sends the whole updated list (add/remove an interest client-side,
  // then PATCH the resulting array).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  wellnessPreferences?: string[];
}
