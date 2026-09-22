'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {BookOpen,Users,BookCopy,CalendarClock,TriangleAlert,Star,Tags,Building2,Boxes,History,LayoutDashboard,Search,RefreshCw,Plus,Pencil,Trash2,X} from 'lucide-react';

const sections=[
  ['Dashboard','dashboard',LayoutDashboard],
  ['Livros','livros',BookOpen],
  ['Usuários','usuarios',Users],
  ['Empréstimos','emprestimos',BookCopy],
  ['Reservas','reservas',CalendarClock],
  ['Multas','multas',TriangleAlert],
  ['Avaliações','avaliacoes',Star],
  ['Categorias','categorias',Tags],
  ['Editoras','editoras',Building2],
  ['Exemplares','exemplares',Boxes],
  ['Histórico','historico_acoes',History]
];

const labels={
  id:'ID',nome:'Nome',titulo:'Título',autor:'Autor',quantidade:'Qtd.',preco:'Preço',
  email:'E-mail',usuario:'Usuário',status:'Status',nota:'Nota',valor:'Valor',
  motivo:'Motivo',acao:'Ação',entidade:'Entidade',comentario:'Comentário',pais:'País',
  id_categoria:'Categoria ID',id_editora:'Editora ID',id_usuario:'Usuário ID',
  id_livro:'Livro ID',id_exemplar:'Exemplar ID',numero_patrimonio:'Patrimônio',
  estado_conservacao:'Conservação',localizacao:'Localização',
  data_emprestimo:'Empréstimo',data_devolucao:'Devolução',
  data_prevista_devolucao:'Prev. devolução',data_reserva:'Reserva',
  data_expiracao:'Expiração',data_multa:'Data',data_pagamento:'Pagamento',
  data_avaliacao:'Data',data_acao:'Data'
};

const value=v=>v==null?'—':typeof v==='object'?JSON.stringify(v):String(v);

export default function Home(){
  const [tab,setTab]=useState('dashboard');
  const [data,setData]=useState({});
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState('');
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [formError,setFormError]=useState('');
  const [notice,setNotice]=useState('');

  async function load(){
    setLoading(true);
    const names=sections.slice(1).map(x=>x[1]);
    const res=await Promise.all(names.map(async t=>{
      const{data,error}=await supabase.from(t).select('*').order('id',{ascending:true}).limit(250);
      return[t,data||[],error];
    }));
    setData(Object.fromEntries(res.map(([t,d])=>[t,d])));
    setLoading(false);
  }

  useEffect(()=>{load()},[]);

  const rows=data[tab]||[];
  const filtered=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  const active=(data.emprestimos||[]).filter(x=>!['devolvido','finalizado'].includes((x.status||'').toLowerCase())).length;
  const overdue=(data.emprestimos||[]).filter(x=>(x.status||'').toLowerCase()==='atrasado').length;
  const pending=(data.multas||[]).filter(x=>!['paga','pago'].includes((x.status||'').toLowerCase())).length;
  const editable=tab==='livros'||tab==='usuarios';

  function openNew(){
    setFormError('');
    if(tab==='livros'){
      setForm({titulo:'',autor:'',quantidade:'1',preco:'',id_categoria:'',id_editora:''});
    }else{
      setForm({nome:'',email:'',usuario:'',senha:''});
    }
    setModal({table:tab,mode:'new'});
  }

  function openEdit(row){
    setFormError('');
    if(tab==='livros'){
      setForm({
        titulo:row.titulo??'',
        autor:row.autor??'',
        quantidade:String(row.quantidade??0),
        preco:String(row.preco??''),
        id_categoria:row.id_categoria==null?'':String(row.id_categoria),
        id_editora:row.id_editora==null?'':String(row.id_editora)
      });
    }else{
      setForm({nome:row.nome??'',email:row.email??'',usuario:row.usuario??'',senha:''});
    }
    setModal({table:tab,mode:'edit',id:row.id});
  }

  async function save(e){
    e.preventDefault();
    setSaving(true);
    setFormError('');

    let payload;
    if(modal.table==='livros'){
      if(!form.titulo?.trim()||!form.autor?.trim()||form.preco===''){
        setFormError('Preencha título, autor e preço.');
        setSaving(false);
        return;
      }
      payload={
        titulo:form.titulo.trim(),
        autor:form.autor.trim(),
        quantidade:Number(form.quantidade||0),
        preco:Number(form.preco),
        id_categoria:form.id_categoria?Number(form.id_categoria):null,
        id_editora:form.id_editora?Number(form.id_editora):null
      };
    }else{
      if(!form.nome?.trim()||!form.email?.trim()||!form.usuario?.trim()||(modal.mode==='new'&&!form.senha)){
        setFormError('Preencha nome, e-mail, usuário e senha.');
        setSaving(false);
        return;
      }
      payload={
        nome:form.nome.trim(),
        email:form.email.trim(),
        usuario:form.usuario.trim()
      };
      if(form.senha) payload.senha=form.senha;
    }

    const query=modal.mode==='new'
      ?supabase.from(modal.table).insert(payload)
      :supabase.from(modal.table).update(payload).eq('id',modal.id);

    const{error}=await query;
    if(error){
      setFormError('Não foi possível salvar: '+error.message);
      setSaving(false);
      return;
    }

    setModal(null);
    setSaving(false);
    setNotice(modal.table==='livros'?'Livro salvo com sucesso.':'Usuário salvo com sucesso.');
    await load();
    setTimeout(()=>setNotice(''),2500);
  }

  async function remove(row){
    const item=tab==='livros'?row.titulo:row.nome;
    if(!confirm(`Excluir "${item}"? Essa ação não pode ser desfeita.`)) return;
    const{error}=await supabase.from(tab).delete().eq('id',row.id);
    if(error){
      setNotice('Não foi possível excluir: '+error.message);
      setTimeout(()=>setNotice(''),4500);
      return;
    }
    setNotice(tab==='livros'?'Livro excluído.':'Usuário excluído.');
    await load();
    setTimeout(()=>setNotice(''),2500);
  }

  return <main>
    <aside>
      <div className="brand"><div className="logo"><BookOpen/></div><div><b>Biblioteca</b><span>2º DS • ETEC</span></div></div>
      <nav>{sections.map(([n,k,I])=><button key={k} className={tab===k?'active':''} onClick={()=>{setTab(k);setQ('');setNotice('')}}><I size={19}/><em>{n}</em></button>)}</nav>
      <div className="foot">Sistema de Biblioteca<br/><small>Supabase + Next.js</small></div>
    </aside>

    <section className="content">
      <header>
        <div><p>Sistema de gerenciamento</p><h1>{sections.find(x=>x[1]===tab)?.[0]}</h1></div>
        <button className="refresh" onClick={load}><RefreshCw size={18}/> Atualizar</button>
      </header>

      {notice&&<div className="notice">{notice}</div>}

      {tab==='dashboard'?<>
        <div className="hero"><div><span>VISÃO GERAL</span><h2>Biblioteca DS</h2><p>Controle o acervo, usuários e empréstimos em um só lugar.</p></div><BookOpen size={78}/></div>
        <div className="cards">
          <Card t="Livros cadastrados" v={(data.livros||[]).length} I={BookOpen}/>
          <Card t="Usuários" v={(data.usuarios||[]).length} I={Users}/>
          <Card t="Empréstimos ativos" v={active} I={BookCopy}/>
          <Card t="Atrasados" v={overdue} I={TriangleAlert}/>
          <Card t="Reservas" v={(data.reservas||[]).length} I={CalendarClock}/>
          <Card t="Multas pendentes" v={pending} I={TriangleAlert}/>
        </div>
        <div className="panel"><h3>Sistema conectado ao Supabase</h3><p>Use o menu para consultar e gerenciar as áreas do banco de dados.</p></div>
      </>:<div className="panel">
        <div className="toolbar">
          <div><h3>{sections.find(x=>x[1]===tab)?.[0]}</h3><span>{filtered.length} registros</span></div>
          <div className="toolbar-actions">
            <label><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar..."/></label>
            {editable&&<button className="primary" onClick={openNew}><Plus size={18}/>{tab==='livros'?'Novo livro':'Novo usuário'}</button>}
          </div>
        </div>
        {loading?<div className="empty">Carregando...</div>:filtered.length?
          <Table rows={filtered} editable={editable} onEdit={openEdit} onDelete={remove}/>
          :<div className="empty">Nenhum registro encontrado.</div>}
      </div>}

      {modal&&<EditorModal
        modal={modal}
        form={form}
        setForm={setForm}
        categories={data.categorias||[]}
        publishers={data.editoras||[]}
        saving={saving}
        error={formError}
        onClose={()=>setModal(null)}
        onSave={save}
      />}
    </section>
  </main>;
}

function Card({t,v,I}){
  return <div className="card"><div className="cardicon"><I/></div><div><span>{t}</span><strong>{v}</strong></div></div>;
}

function Table({rows,editable,onEdit,onDelete}){
  const keys=Object.keys(rows[0]||{}).filter(k=>k!=='senha');
  return <div className="tablewrap"><table>
    <thead><tr>{keys.map(k=><th key={k}>{labels[k]||k.replaceAll('_',' ')}</th>)}{editable&&<th>Ações</th>}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={r.id??i}>
      {keys.map(k=><td key={k}>{value(r[k])}</td>)}
      {editable&&<td><div className="row-actions">
        <button className="icon-btn" title="Editar" onClick={()=>onEdit(r)}><Pencil size={16}/></button>
        <button className="icon-btn danger" title="Excluir" onClick={()=>onDelete(r)}><Trash2 size={16}/></button>
      </div></td>}
    </tr>)}</tbody>
  </table></div>;
}

function EditorModal({modal,form,setForm,categories,publishers,saving,error,onClose,onSave}){
  const book=modal.table==='livros';
  const update=(field,value)=>setForm(f=>({...f,[field]:value}));
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="modal">
      <div className="modal-head">
        <div><span>{modal.mode==='new'?'CADASTRO':'EDIÇÃO'}</span><h2>{book?(modal.mode==='new'?'Novo livro':'Editar livro'):(modal.mode==='new'?'Novo usuário':'Editar usuário')}</h2></div>
        <button className="close-btn" onClick={onClose}><X size={20}/></button>
      </div>
      <form onSubmit={onSave}>
        {book?<>
          <div className="field full"><label>Título</label><input value={form.titulo||''} onChange={e=>update('titulo',e.target.value)} placeholder="Ex.: Dom Casmurro"/></div>
          <div className="field full"><label>Autor</label><input value={form.autor||''} onChange={e=>update('autor',e.target.value)} placeholder="Nome do autor"/></div>
          <div className="form-grid">
            <div className="field"><label>Quantidade</label><input type="number" min="0" value={form.quantidade||''} onChange={e=>update('quantidade',e.target.value)}/></div>
            <div className="field"><label>Preço de aluguel</label><input type="number" min="0" step="0.01" value={form.preco||''} onChange={e=>update('preco',e.target.value)} placeholder="0,00"/></div>
            <div className="field"><label>Categoria</label><select value={form.id_categoria||''} onChange={e=>update('id_categoria',e.target.value)}><option value="">Sem categoria</option>{categories.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
            <div className="field"><label>Editora</label><select value={form.id_editora||''} onChange={e=>update('id_editora',e.target.value)}><option value="">Sem editora</option>{publishers.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
          </div>
        </>:<>
          <div className="field full"><label>Nome</label><input value={form.nome||''} onChange={e=>update('nome',e.target.value)} placeholder="Nome completo"/></div>
          <div className="field full"><label>E-mail</label><input type="email" value={form.email||''} onChange={e=>update('email',e.target.value)} placeholder="usuario@email.com"/></div>
          <div className="form-grid">
            <div className="field"><label>Usuário</label><input value={form.usuario||''} onChange={e=>update('usuario',e.target.value)} placeholder="login"/></div>
            <div className="field"><label>Senha</label><input type="password" value={form.senha||''} onChange={e=>update('senha',e.target.value)} placeholder={modal.mode==='edit'?'Deixe vazio para manter':'Digite uma senha'}/></div>
          </div>
        </>}
        {error&&<div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving?'Salvando...':'Salvar'}</button></div>
      </form>
    </div>
  </div>;
}
