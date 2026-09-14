import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import type { PriceRegion } from "../pricing.service";

const REGIONS: PriceRegion[] = ["IN", "GLOBAL"];
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const CODE_MESSAGE = "That discount code isn't valid.";

export class PricingQueryDto {
  @IsOptional()
  @IsIn(REGIONS)
  region?: PriceRegion;
}

export class ValidateDiscountDto {
  @IsString()
  @Length(1, 64, { message: CODE_MESSAGE })
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;

  @IsOptional()
  @IsIn(REGIONS)
  region?: PriceRegion;
}

export class CheckoutDto {
  @IsOptional()
  @IsString()
  @Length(1, 64, { message: CODE_MESSAGE })
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  discountCode?: string;
}
