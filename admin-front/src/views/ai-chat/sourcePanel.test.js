// 单元测试：SourcePanel 引用来源面板
// 覆盖：正常渲染 / 边界值（空列表、null 计数、序号越界、score 为 0）/ 异常输入（字段缺失）
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SourcePanel from "./sourcePanel.vue";

const mountPanel = ( props = {} ) =>
  mount( SourcePanel, {
    props: {
      sources: [],
      ...props,
    },
  } );

describe( "SourcePanel 引用来源面板", () =>
{
  describe( "正常场景", () =>
  {
    it( "渲染命中数量、序号、标题、摘要、相似度与行号", () =>
    {
      const sources = [
        { title: "a.md", preview: "内容A", score: 0.9, startLine: 1, endLine: 10 },
        { title: "b.sql", preview: "内容B", score: 0.75, startLine: 20 },
      ];
      const wrapper = mountPanel( { sources, vectorCount: 123 } );

      expect( wrapper.findAll( ".source-item" ) ).toHaveLength( 2 );
      expect( wrapper.find( ".hit-count" ).text() ).toContain( "2" );

      const items = wrapper.findAll( ".source-item" );
      expect( items[ 0 ].find( ".source-index" ).text() ).toBe( "①" );
      expect( items[ 0 ].find( ".source-name" ).text() ).toBe( "a.md" );
      expect( items[ 0 ].find( ".source-preview" ).text() ).toBe( "内容A" );
      expect( items[ 0 ].find( ".source-score" ).text() ).toContain( "0.90" );
      expect( items[ 0 ].find( ".source-lines" ).text() ).toContain( "1-10" );

      expect( items[ 1 ].find( ".source-index" ).text() ).toBe( "②" );
      // 只给 startLine 时，结束行回退为起始行
      expect( items[ 1 ].find( ".source-lines" ).text() ).toContain( "20-20" );

      expect( wrapper.find( ".vector-count" ).text() ).toContain( "123" );
    } );

    it( "无检索结果时展示空态文案", () =>
    {
      const wrapper = mountPanel( { sources: [] } );
      expect( wrapper.find( ".source-empty" ).exists() ).toBe( true );
      expect( wrapper.find( ".source-list" ).text() ).toContain( "本次回答未命中知识库片段" );
      expect( wrapper.find( ".hit-count" ).text() ).toContain( "0" );
    } );
  } );

  describe( "边界值", () =>
  {
    it( "vectorCount 为 null 时展示占位符 --", () =>
    {
      const wrapper = mountPanel( { sources: [], vectorCount: null } );
      expect( wrapper.find( ".vector-count" ).text() ).toContain( "--" );
    } );

    it( "vectorCount 为 undefined 时展示占位符 --", () =>
    {
      const wrapper = mountPanel( { sources: [], vectorCount: undefined } );
      expect( wrapper.find( ".vector-count" ).text() ).toContain( "--" );
    } );

    it( "vectorCount 为 0 时展示 0 而不是占位符", () =>
    {
      const wrapper = mountPanel( { sources: [], vectorCount: 0 } );
      expect( wrapper.find( ".vector-count" ).text() ).toContain( "0" );
      expect( wrapper.find( ".vector-count" ).text() ).not.toContain( "--" );
    } );

    it( "score 为 0 时展示 0.00", () =>
    {
      const wrapper = mountPanel( { sources: [ { title: "a", score: 0 } ] } );
      expect( wrapper.find( ".source-score" ).text() ).toContain( "0.00" );
    } );

    it( "缺少 startLine 时不渲染行号", () =>
    {
      const wrapper = mountPanel( { sources: [ { title: "a", preview: "p" } ] } );
      expect( wrapper.find( ".source-lines" ).exists() ).toBe( false );
    } );

    it( "超过 20 条时序号退化为括号数字", () =>
    {
      const sources = Array.from( { length: 21 }, ( _, i ) => ( { title: `doc-${ i + 1 }` } ) );
      const wrapper = mountPanel( { sources } );
      const items = wrapper.findAll( ".source-item" );
      expect( items[ 19 ].find( ".source-index" ).text() ).toBe( "⑳" );
      expect( items[ 20 ].find( ".source-index" ).text() ).toBe( "(21)" );
    } );

    it( "score 非数字时不展示相似度", () =>
    {
      const wrapper = mountPanel( { sources: [ { title: "a", score: undefined } ] } );
      expect( wrapper.find( ".source-score" ).exists() ).toBe( false );
    } );
  } );

  describe( "异常输入", () =>
  {
    it( "字段全部缺失时标题回退为未知来源、摘要回退为默认文案", () =>
    {
      const wrapper = mountPanel( { sources: [ {} ] } );
      expect( wrapper.find( ".source-name" ).text() ).toBe( "未知来源" );
      expect( wrapper.find( ".source-preview" ).text() ).toBe( "该片段暂无摘要" );
    } );

    it( "仅提供 docId 时标题回退为条目 ID", () =>
    {
      const wrapper = mountPanel( { sources: [ { docId: 5 } ] } );
      expect( wrapper.find( ".source-name" ).text() ).toBe( "条目 5" );
    } );

    it( "仅提供 source 时用 source 作为标题", () =>
    {
      const wrapper = mountPanel( { sources: [ { source: "x.sql" } ] } );
      expect( wrapper.find( ".source-name" ).text() ).toBe( "x.sql" );
    } );

    it( "title 为空字符串时回退到 source 字段", () =>
    {
      const wrapper = mountPanel( { sources: [ { title: "", source: "fallback.md" } ] } );
      expect( wrapper.find( ".source-name" ).text() ).toBe( "fallback.md" );
    } );
  } );
} );
