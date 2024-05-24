import{_ as i}from"./plugin-vue_export-helper-DlAUqK2U.js";import{r as s,o as r,c,a as e,d as t,b as a,e as o}from"./app-BT69gyAK.js";const l={},d=o('<h2 id="introduction" tabindex="-1"><a class="header-anchor" href="#introduction"><span>Introduction</span></a></h2><p>Prior to Sui 0.28.x to submit transactions with mutliple commands one was required to invoke the,<br> recently renamed, <code>unsafe_batchTransaction</code>. This is somewhat limited to allowing only calls to<br><code>public entry fun</code> functions on contracts (a.k.a. move calls) and object transfers.</p><p>Recently MystenLabs introduced &#39;programmable transactions&#39; which expanded<br> the capability of structuring multiple-diverse commands, sharing results between commands, lifting the<br> limitations of calling only <code>public entry fun</code> to now include any <code>public fun</code> contract functions and much more.</p>',3),m={href:"https://docs.sui.io/devnet/build/prog-trans-ts-sdk",target:"_blank",rel:"noopener noreferrer"},u=o('<h2 id="this-document" tabindex="-1"><a class="header-anchor" href="#this-document"><span>This document</span></a></h2><p>The purpose of this guide is to add <strong>general</strong>, language agnostic, information about programmable transactions (herein referred to simply as &#39;transaction&#39; or &#39;transactions&#39;).</p><h2 id="what-is-a-transaction" tabindex="-1"><a class="header-anchor" href="#what-is-a-transaction"><span>What is a Transaction?</span></a></h2><ul><li>Transactions may contain one or more <a href="#what-are-commands">commands</a></li><li>Transactions support multiple <a href="#signing-transactions">signers</a></li><li>If one command in a transaction fails, the whole transaction fails</li><li>Transactions are inspectable (<code>sui_devInspectTransactionBlock</code> ) and can be dry-run (<code>sui_dryRunTransactionBlock</code>) as well</li><li>End points (i.e. devnet, testnet, etc.) are configurable</li></ul><h3 id="what-are-commands" tabindex="-1"><a class="header-anchor" href="#what-are-commands"><span>What are Commands</span></a></h3><p>Commands are a single unit of execution to which you can add many in a single transaction:</p><ul><li>Some of the SDK in the references come with &#39;out of the box&#39; commands, such as <code>split</code>,<code>merge</code> and <code>transfer</code></li><li>Commands can contain calls to Sui contracts/packages (i.e. move calls)</li><li>Move calls are not limited to <code>public entry</code> functions of the contract, calls to any <code>public</code> function are supported</li><li>Commands are run <em>sequentially</em></li><li>Command inputs may be simple (numbers, strings, addresses) or objects (coins, NFTs, shared objects, etc.)</li><li>Typically non-object inputs are often called &#39;pure&#39; wheras objects are called, well, &#39;objects&#39;</li><li>Inputs may be collections (i.e. vectors, lists or arrays) of &#39;pure&#39; types</li><li>Collections of objects are supported through &#39;making a Move vector&#39;, the results of which can be used as input<br> to subesquent commands</li><li>Results of commands may be used as inputs to subsequent commands</li><li>Not all commands return a re-usable results. For example: <code>transfer</code> does not return a reusable result</li><li>Results may be a single result or an array/list of results</li></ul><h3 id="known-command-restrictions" tabindex="-1"><a class="header-anchor" href="#known-command-restrictions"><span>Known Command Restrictions</span></a></h3><ul><li>Commands can only operate with mutiple objects for which the primary sender can sign. In other words, if one command is<br> operating with address &#39;A&#39; owned objects, a subequent command can not include address &#39;B&#39; owned objects as there is no<br> way to include another signer. This restriction, and the associated signing liimitation, is reported to be in review to hopefully ease this constraint</li><li>Collections are limited to a depth level of 16 (e.g. <code>vector&lt;vector&lt;vector&lt;.....&gt;&gt;&gt;</code>)</li><li>Additional transactions and command constraints can be viewed via the <code>sui_getProtocolConfig</code> RPC method</li></ul><h3 id="signing-transactions" tabindex="-1"><a class="header-anchor" href="#signing-transactions"><span>Signing Transactions</span></a></h3><p>At the time of this writing, a maximum of two (2) signers are allowable:</p><ol><li>The sender, sometimes referred to as the primary signer (can be a MultiSig)</li><li>A sponsor if the payment for the transaction (gas) is provided by another gas object owner (can be a MultiSig)</li></ol><h2 id="additional-references" tabindex="-1"><a class="header-anchor" href="#additional-references"><span>Additional References</span></a></h2><p>Programmable transactions are supported in multiple programming languagges. Known at the time of this writing:</p>',14),h=e("li",null,"Typescript: MystenLabs TS SDK",-1),p=e("li",null,"Rust: MystenLab Rust SDK",-1),g={href:"https://github.com/FrankC01/pysui",target:"_blank",rel:"noopener noreferrer"};function b(f,y){const n=s("ExternalLinkIcon");return r(),c("div",null,[d,e("p",null,[t("The current MystenLabs documentation (using Typescript examples) can be found "),e("a",m,[t("Here"),a(n)])]),u,e("ul",null,[h,p,e("li",null,[t("Python: "),e("a",g,[t("pysui"),a(n)])])])])}const _=i(l,[["render",b],["__file","progtxns.html.vue"]]),k=JSON.parse('{"path":"/cookbook/guides/progtxns.html","title":"Programmable Transaction","lang":"en-US","frontmatter":{"title":"Programmable Transaction","order":4,"contributors":true,"editLink":true,"description":"Introduction Prior to Sui 0.28.x to submit transactions with mutliple commands one was required to invoke the, recently renamed, unsafe_batchTransaction. This is somewhat limite...","head":[["meta",{"property":"og:url","content":"https://suibase.io/cookbook/guides/progtxns.html"}],["meta",{"property":"og:site_name","content":"suibase.io"}],["meta",{"property":"og:title","content":"Programmable Transaction"}],["meta",{"property":"og:description","content":"Introduction Prior to Sui 0.28.x to submit transactions with mutliple commands one was required to invoke the, recently renamed, unsafe_batchTransaction. This is somewhat limite..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"en-US"}],["meta",{"property":"og:updated_time","content":"2023-05-11T09:32:18.000Z"}],["meta",{"property":"article:author","content":"suibase.io"}],["meta",{"property":"article:modified_time","content":"2023-05-11T09:32:18.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"Programmable Transaction\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2023-05-11T09:32:18.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"suibase.io\\",\\"url\\":\\"https://suibase.io\\"}]}"]]},"headers":[{"level":2,"title":"Introduction","slug":"introduction","link":"#introduction","children":[]},{"level":2,"title":"This document","slug":"this-document","link":"#this-document","children":[]},{"level":2,"title":"What is a Transaction?","slug":"what-is-a-transaction","link":"#what-is-a-transaction","children":[{"level":3,"title":"What are Commands","slug":"what-are-commands","link":"#what-are-commands","children":[]},{"level":3,"title":"Known Command Restrictions","slug":"known-command-restrictions","link":"#known-command-restrictions","children":[]},{"level":3,"title":"Signing Transactions","slug":"signing-transactions","link":"#signing-transactions","children":[]}]},{"level":2,"title":"Additional References","slug":"additional-references","link":"#additional-references","children":[]}],"git":{"createdTime":1682543300000,"updatedTime":1683797538000,"contributors":[{"name":"Frank V. Castellucci","email":"frankiecast@gmail.com","commits":3}]},"readingTime":{"minutes":1.77,"words":531},"filePathRelative":"cookbook/guides/progtxns.md","localizedDate":"April 26, 2023","autoDesc":true}');export{_ as comp,k as data};
