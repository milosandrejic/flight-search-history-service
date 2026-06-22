import { Get, Body, Post, Param, Query, Controller } from "@nestjs/common";

import { CreateSearchDto } from "./dto/create-search.dto";
import { SearchHistoryService } from "./search-history.service";

@Controller("search")
export class SearchHistoryController {
  constructor(private readonly searchHistoryService: SearchHistoryService) {}

  @Post()
  create(@Body() dto: CreateSearchDto) {
    return this.searchHistoryService.createSearch(dto);
  }

  @Get("recent")
  getRecent(@Query("userId") userId: string, @Query("limit") limit: string) {
    return this.searchHistoryService.getRecentSearches(userId, Number(limit) || 10);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.searchHistoryService.getSearch(id);
  }
}
