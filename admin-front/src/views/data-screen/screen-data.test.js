import { describe, it, expect } from "vitest";
import {
  SCREEN_DATA_IS_DEMO,
  TOURIST_STAT,
  GENDER_RATIO,
  AGE_DISTRIBUTION,
  SCENIC_RANKING,
  TREND,
  YEAR_COMPARISON,
  RESERVE_CHANNELS,
  MAP_FLOW,
} from "@/views/data-screen/screen-data";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const isNonNegativeNumber = ( value ) =>
  typeof value === "number" && Number.isFinite( value ) && value >= 0;

describe( "screen-data 演示数据模块", () =>
{
  it( "全部常量均已导出", () =>
  {
    expect( SCREEN_DATA_IS_DEMO ).toBeDefined();
    expect( TOURIST_STAT ).toBeDefined();
    expect( GENDER_RATIO ).toBeDefined();
    expect( AGE_DISTRIBUTION ).toBeDefined();
    expect( SCENIC_RANKING ).toBeDefined();
    expect( TREND ).toBeDefined();
    expect( YEAR_COMPARISON ).toBeDefined();
    expect( RESERVE_CHANNELS ).toBeDefined();
    expect( MAP_FLOW ).toBeDefined();
  } );

  it( "SCREEN_DATA_IS_DEMO 为布尔值（当前无接口，恒为 true）", () =>
  {
    expect( typeof SCREEN_DATA_IS_DEMO ).toBe( "boolean" );
    expect( SCREEN_DATA_IS_DEMO ).toBe( true );
  } );

  describe( "TOURIST_STAT", () =>
  {
    it( "实时游客数与可预约总量均为非负数值", () =>
    {
      expect( isNonNegativeNumber( TOURIST_STAT.count ) ).toBe( true );
      expect( isNonNegativeNumber( TOURIST_STAT.reserveTotal ) ).toBe( true );
    } );

    it( "fillLevels 为非空数组，且每个值都落在 0-1 之间", () =>
    {
      expect( Array.isArray( TOURIST_STAT.fillLevels ) ).toBe( true );
      expect( TOURIST_STAT.fillLevels.length ).toBeGreaterThan( 0 );
      TOURIST_STAT.fillLevels.forEach( ( level ) =>
      {
        expect( typeof level ).toBe( "number" );
        expect( level ).toBeGreaterThanOrEqual( 0 );
        expect( level ).toBeLessThanOrEqual( 1 );
      } );
    } );
  } );

  describe( "GENDER_RATIO", () =>
  {
    it( "男女人数均非负且相加为 100", () =>
    {
      expect( isNonNegativeNumber( GENDER_RATIO.male ) ).toBe( true );
      expect( isNonNegativeNumber( GENDER_RATIO.female ) ).toBe( true );
      expect( GENDER_RATIO.male + GENDER_RATIO.female ).toBe( 100 );
    } );
  } );

  describe( "AGE_DISTRIBUTION", () =>
  {
    it( "非空数组，每项结构完整（name / value / color）且数值非负", () =>
    {
      expect( Array.isArray( AGE_DISTRIBUTION ) ).toBe( true );
      expect( AGE_DISTRIBUTION.length ).toBeGreaterThan( 0 );

      AGE_DISTRIBUTION.forEach( ( item ) =>
      {
        expect( typeof item.name ).toBe( "string" );
        expect( item.name.length ).toBeGreaterThan( 0 );
        expect( isNonNegativeNumber( item.value ) ).toBe( true );
        expect( item.color ).toMatch( HEX_COLOR );
      } );
    } );

    it( "名称不重复（图例与饼图一一对应）", () =>
    {
      const names = AGE_DISTRIBUTION.map( ( item ) => item.name );
      expect( new Set( names ).size ).toBe( names.length );
    } );
  } );

  describe( "SCENIC_RANKING", () =>
  {
    it( "非空数组，数值非负、占比在 0-100 之间、颜色合法", () =>
    {
      expect( Array.isArray( SCENIC_RANKING ) ).toBe( true );
      expect( SCENIC_RANKING.length ).toBeGreaterThan( 0 );

      SCENIC_RANKING.forEach( ( item ) =>
      {
        expect( typeof item.name ).toBe( "string" );
        expect( isNonNegativeNumber( item.value ) ).toBe( true );
        expect( isNonNegativeNumber( item.rate ) ).toBe( true );
        expect( item.rate ).toBeLessThanOrEqual( 100 );
        expect( typeof item.rank ).toBe( "string" );
        expect( item.rankColor ).toMatch( HEX_COLOR );
      } );
    } );
  } );

  describe( "TREND", () =>
  {
    it( "日期与游客量一一对应且非空", () =>
    {
      expect( Array.isArray( TREND.dates ) ).toBe( true );
      expect( TREND.dates.length ).toBeGreaterThan( 0 );
      expect( TREND.visitors.length ).toBe( TREND.dates.length );
    } );

    it( "游客量均非负，Y 轴上限不小于实际最大值", () =>
    {
      TREND.visitors.forEach( ( value ) =>
      {
        expect( isNonNegativeNumber( value ) ).toBe( true );
      } );

      expect( isNonNegativeNumber( TREND.maxVisitors ) ).toBe( true );
      expect( TREND.maxVisitors ).toBeGreaterThanOrEqual( Math.max( ...TREND.visitors ) );
    } );
  } );

  describe( "YEAR_COMPARISON", () =>
  {
    it( "月份为 12 个", () =>
    {
      expect( Array.isArray( YEAR_COMPARISON.months ) ).toBe( true );
      expect( YEAR_COMPARISON.months ).toHaveLength( 12 );
    } );

    it( "series 非空，名称唯一、数据长度与月份一致、数值非负、颜色合法", () =>
    {
      expect( Array.isArray( YEAR_COMPARISON.series ) ).toBe( true );
      expect( YEAR_COMPARISON.series.length ).toBeGreaterThan( 0 );

      const names = YEAR_COMPARISON.series.map( ( s ) => s.name );
      expect( new Set( names ).size ).toBe( names.length );

      YEAR_COMPARISON.series.forEach( ( series ) =>
      {
        expect( typeof series.name ).toBe( "string" );
        expect( series.name.length ).toBeGreaterThan( 0 );
        expect( series.color ).toMatch( HEX_COLOR );
        expect( series.data ).toHaveLength( YEAR_COMPARISON.months.length );
        series.data.forEach( ( value ) =>
        {
          expect( isNonNegativeNumber( value ) ).toBe( true );
        } );
      } );
    } );

    it( "series 与 legend 名称一一对应", () =>
    {
      const legend = YEAR_COMPARISON.series.map( ( s ) => s.name );

      YEAR_COMPARISON.series.forEach( ( series ) =>
      {
        expect( legend ).toContain( series.name );
      } );

      expect( legend ).toHaveLength( YEAR_COMPARISON.series.length );
      expect( new Set( legend ).size ).toBe( legend.length );
    } );

    it( "Y 轴上限与刻度间隔为正且可整除", () =>
    {
      expect( isNonNegativeNumber( YEAR_COMPARISON.maxValue ) ).toBe( true );
      expect( YEAR_COMPARISON.maxValue ).toBeGreaterThan( 0 );
      expect( isNonNegativeNumber( YEAR_COMPARISON.interval ) ).toBe( true );
      expect( YEAR_COMPARISON.interval ).toBeGreaterThan( 0 );
      expect( YEAR_COMPARISON.maxValue % YEAR_COMPARISON.interval ).toBe( 0 );
    } );
  } );

  describe( "RESERVE_CHANNELS", () =>
  {
    it( "非空数组，数值非负、渐变数组非空且为合法颜色", () =>
    {
      expect( Array.isArray( RESERVE_CHANNELS ) ).toBe( true );
      expect( RESERVE_CHANNELS.length ).toBeGreaterThan( 0 );

      RESERVE_CHANNELS.forEach( ( channel ) =>
      {
        expect( typeof channel.name ).toBe( "string" );
        expect( isNonNegativeNumber( channel.value ) ).toBe( true );
        expect( Array.isArray( channel.gradient ) ).toBe( true );
        expect( channel.gradient.length ).toBeGreaterThan( 0 );
        channel.gradient.forEach( ( color ) =>
        {
          expect( color ).toMatch( HEX_COLOR );
        } );
      } );
    } );

    it( "渠道名称唯一", () =>
    {
      const names = RESERVE_CHANNELS.map( ( c ) => c.name );
      expect( new Set( names ).size ).toBe( names.length );
    } );
  } );

  describe( "MAP_FLOW", () =>
  {
    it( "预警条数非负、客流线坐标结构正确", () =>
    {
      expect( isNonNegativeNumber( MAP_FLOW.warningCount ) ).toBe( true );

      expect( Array.isArray( MAP_FLOW.lines ) ).toBe( true );
      expect( MAP_FLOW.lines.length ).toBeGreaterThan( 0 );

      MAP_FLOW.lines.forEach( ( line ) =>
      {
        expect( typeof line.label ).toBe( "string" );
        expect( line.coords ).toHaveLength( 2 );
        line.coords.forEach( ( point ) =>
        {
          expect( point ).toHaveLength( 2 );
          point.forEach( ( num ) =>
          {
            expect( typeof num ).toBe( "number" );
          } );
        } );
      } );
    } );
  } );
} );
