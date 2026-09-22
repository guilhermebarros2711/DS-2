'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';
import {
  BookOpen,Users,BookCopy,CalendarClock,TriangleAlert,Star,Tags,Building2,Boxes,History,
  LayoutDashboard,Search,RefreshCw,Plus,Pencil,Trash2,X,ArrowUpRight,Clock3,LibraryBig,
  CheckCircle2,CircleDollarSign,Sparkles
} from 'lucide-react';

const navGroups=[
  {label:'Visão geral',items:[['Dashboard','dashboard',LayoutDashboard]]},
  {label:'Circulação',items:[
    ['Empréstimos','emprestimos',BookCopy],
    ['Reservas','reservas',CalendarClock],
    ['Multas','multas',TriangleAlert]
  ]},
  {label:'Acervo',items:[
    ['Livros','livros',BookOpen],
    ['Exemplares','exemplares',Boxes],
    ['Categorias','categorias',Tags],
    ['Editoras','editoras',Building2]
  ]},
  {label:'Pessoas e atividade',items:[
    ['Usuários','usuarios',Users],
    ['Avaliações','avaliacoes',Star],
    ['Histórico','historico_acoes',History]
  ]}
];

const sections=navGroups.flatMap(group=>group.items);

const labels={
  id:'ID',nome:'Nome',titulo:'Título',autor:'Autor',quantidade:'Qtd.',preco:'Preço',
  email:'E-mail',usuario:'Usuário',status:'Status',nota:'Nota',valor:'Valor',
  motivo:'Motivo',acao:'Ação',entidade:'Entidade',comentario:'Comentário',pais:'País',
  id_categoria:'Categoria',id_editora:'Editora',id_usuario:'Usuário',
  id_livro:'Livro',id_exemplar:'Exemplar',numero_patrimonio:'Patrimônio',
  estado_conservacao:'Conservação',localizacao:'Localização',
  data_emprestimo:'Empréstimo',data_devolucao:'Devolução',
  data_prevista_devolucao:'Prev. devolução',data_reserva:'Reserva',
  data_expiracao:'Expiração',data_multa:'Data',data_pagamento:'Pagamento',
  data_avaliacao:'Data',data_acao:'Data'
};

const dateFields=new Set([
  'data_emprestimo','data_devolucao','data_prevista_devolucao','data_reserva',
  'data_expiracao','data_multa','data_pagamento','data_avaliacao','data_acao',
  'created_at','updated_at'
]);

const currencyFields=new Set(['preco','valor']);

function normalizeStatus(status=''){
  return String(status).trim().toLowerCase();
}

function statusClass(status=''){
  const s=normalizeStatus(status);
  if(['atrasado','pendente','não pago','nao pago','vencido','cancelado'].some(x=>s.includes(x))) return 'danger';
  if(['devolvido','finalizado','pago','concluido','concluído','disponivel','disponível'].some(x=>s.includes(x))) return 'success';
  if(['ativo','emprestado','reservado','em andamento','aberto'].some(x=>s.includes(x))) return 'info';
  return 'neutral';
}

function formatDate(value){
  if(!value) return '—';
  const raw=String(value);
  if(/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)){
    const [year,month,day]=raw.split('-');
    return day+'/'+month+'/'+year;
  }
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-BR',{
    day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(date);
}

function formatMoney(value){
  const n=Number(value);
  if(Number.isNaN(n)) return String(value??'—');
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
}

function relationLabel(key,value,data){
  if(value==null) return '—';
  const id=Number(value);
  if(key==='id_usuario'){
    const item=(data.usuarios||[]).find(x=>Number(x.id)===id);
    return item ? item.nome || item.usuario || '#'+value : '#'+value;
  }
  if(key==='id_livro'){
    const item=(data.livros||[]).find(x=>Number(x.id)===id);
    return item ? item.titulo || '#'+value : '#'+value;
  }
  if(key==='id_categoria'){
    const item=(data.categorias||[]).find(x=>Number(x.id)===id);
    return item ? item.nome || '#'+value : '#'+value;
  }
  if(key==='id_editora'){
    const item=(data.editoras||[]).find(x=>Number(x.id)===id);
    return item ? item.nome || '#'+value : '#'+value;
  }
  if(key==='id_exemplar'){
    const item=(data.exemplares||[]).find(x=>Number(x.id)===id);
    return item ? item.numero_patrimonio || '#'+value : '#'+value;
  }
  return null;
}

function displayValue(key,value,data){
  const relation=relationLabel(key,value,data);
  if(relation!==null) return relation;
  if(dateFields.has(key)) return formatDate(value);
  if(currencyFields.has(key)) return formatMoney(value);
  if(value==null||value==='') return '—';
  if(typeof value==='boolean') return value?'Sim':'Não';
  if(typeof value==='object') return JSON.stringify(value);
  return String(value);
}

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
    const res=await Promise.all(names.map(async table=>{
      const query=table==='usuarios'
        ?supabase.from(table).select('id,nome,email,usuario').order('id',{ascending:true}).limit(250)
        :supabase.from(table).select('*').order('id',{ascending:true}).limit(250);
      const{data,error}=await query;
      return[table,data||[],error];
    }));
    setData(Object.fromEntries(res.map(([table,rows])=>[table,rows])));
    setLoading(false);
  }

  useEffect(()=>{load()},[]);

  const rows=data[tab]||[];
  const filtered=rows.filter(row=>JSON.stringify(row).toLowerCase().includes(q.toLowerCase()));
  const loans=data.emprestimos||[];
  const active=loans.filter(x=>!['devolvido','finalizado'].includes(normalizeStatus(x.status))).length;
  const overdue=loans.filter(x=>normalizeStatus(x.status)==='atrasado').length;
  const pending=(data.multas||[]).filter(x=>!['paga','pago'].includes(normalizeStatus(x.status))).length;
  const editable=tab==='livros'||tab==='usuarios';

  const recentLoans=useMemo(()=>[...(data.emprestimos||[])]
    .sort((a,b)=>Number(b.id||0)-Number(a.id||0))
    .slice(0,5),[data.emprestimos]);

  const totalCopies=(data.exemplares||[]).length;
  const availableCopies=(data.exemplares||[]).filter(x=>['disponivel','disponível'].includes(normalizeStatus(x.status))).length;
  const activeReservations=(data.reservas||[]).filter(x=>!['cancelada','cancelado','finalizada','finalizado','expirada','expirado'].includes(normalizeStatus(x.status))).length;

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
    if(!confirm('Excluir "'+item+'"? Essa ação não pode ser desfeita.')) return;
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

  function selectTab(key){
    setTab(key);
    setQ('');
    setNotice('');
  }

  return <main>
    <aside>
      <div className="brand">
        <div className="logo"><BookOpen size={23}/><span>DS</span></div>
        <div><b>Biblioteca DS</b><span>2º DS • ETEC</span></div>
      </div>

      <nav>
        {navGroups.map(group=><div className="nav-group" key={group.label}>
          <span className="nav-label">{group.label}</span>
          {group.items.map(([name,key,Icon])=>
            <button key={key} className={tab===key?'active':''} onClick={()=>selectTab(key)}>
              <Icon size={18}/><em>{name}</em>
            </button>
          )}
        </div>)}
      </nav>

      <div className="foot">
        <span className="connection-dot"></span> Supabase conectado
        <small>Next.js • Vercel</small>
      </div>
    </aside>

    <section className="content">
      <header>
        <div>
          <p>Sistema de gerenciamento</p>
          <h1>{sections.find(x=>x[1]===tab)?.[0]}</h1>
        </div>
        <button className="refresh" onClick={load} disabled={loading}>
          <RefreshCw size={17} className={loading?'spin':''}/>{loading?'Atualizando':'Atualizar'}
        </button>
      </header>

      {notice&&<div className="notice"><CheckCircle2 size={17}/>{notice}</div>}

      {tab==='dashboard'?<>
        <div className="hero">
          <div>
            <span className="eyebrow"><Sparkles size={13}/> VISÃO GERAL</span>
            <h2>Biblioteca DS</h2>
            <p>Acervo, circulação e usuários organizados em um só lugar.</p>
            <button className="hero-action" onClick={()=>selectTab('emprestimos')}>
              Ver empréstimos <ArrowUpRight size={16}/>
            </button>
          </div>
          <div className="hero-mark"><BookOpen size={74}/><b>DS</b></div>
        </div>

        <div className="cards">
          <Card t="Livros cadastrados" v={(data.livros||[]).length} I={BookOpen} tone="blue"/>
          <Card t="Usuários" v={(data.usuarios||[]).length} I={Users} tone="violet"/>
          <Card t="Empréstimos ativos" v={active} I={BookCopy} tone="cyan"/>
          <Card t="Atrasados" v={overdue} I={TriangleAlert} tone={overdue?'red':'green'}/>
          <Card t="Reservas ativas" v={activeReservations} I={CalendarClock} tone="amber"/>
          <Card t="Multas pendentes" v={pending} I={CircleDollarSign} tone={pending?'red':'green'}/>
        </div>

        <div className="dashboard-grid">
          <div className="panel activity-panel">
            <div className="panel-head">
              <div><span className="panel-kicker">MOVIMENTAÇÃO</span><h3>Empréstimos recentes</h3></div>
              <button className="text-button" onClick={()=>selectTab('emprestimos')}>Ver todos <ArrowUpRight size={15}/></button>
            </div>
            {recentLoans.length?<div className="activity-list">
              {recentLoans.map((loan,i)=><LoanRow key={loan.id??i} loan={loan} data={data}/>)}
            </div>:<EmptyState compact text="Nenhum empréstimo registrado ainda."/>}
          </div>

          <div className="panel circulation-panel">
            <div className="panel-head">
              <div><span className="panel-kicker">RESUMO</span><h3>Situação da circulação</h3></div>
              <LibraryBig size={21}/>
            </div>
            <MetricRow label="Exemplares cadastrados" value={totalCopies} icon={Boxes}/>
            <MetricRow label="Exemplares disponíveis" value={availableCopies} icon={BookOpen}/>
            <MetricRow label="Empréstimos em aberto" value={active} icon={Clock3}/>
            <MetricRow label="Pendências financeiras" value={pending} icon={CircleDollarSign}/>
          </div>
        </div>
      </>:<div className="panel">
        <div className="toolbar">
          <div>
            <span className="panel-kicker">BANCO DE DADOS</span>
            <h3>{sections.find(x=>x[1]===tab)?.[0]}</h3>
            <span>{filtered.length} {filtered.length===1?'registro':'registros'}</span>
          </div>
          <div className="toolbar-actions">
            <label><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={'Pesquisar em '+(sections.find(x=>x[1]===tab)?.[0]||'registros').toLowerCase()+'...'}/></label>
            {editable&&<button className="primary" onClick={openNew}><Plus size={18}/>{tab==='livros'?'Novo livro':'Novo usuário'}</button>}
          </div>
        </div>

        {loading?<EmptyState loading text="Carregando dados..."/>:filtered.length?
          <Table rows={filtered} data={data} editable={editable} onEdit={openEdit} onDelete={remove}/>
          :<EmptyState text={q?'Nenhum resultado para essa busca.':'Nenhum registro encontrado.'}/>}
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

function Card({t,v,I,tone='blue'}){
  return <div className={'card tone-'+tone}>
    <div className="cardicon"><I size={20}/></div>
    <div><span>{t}</span><strong>{v}</strong></div>
  </div>;
}

function MetricRow({label,value,icon:Icon}){
  return <div className="metric-row">
    <div className="metric-icon"><Icon size={17}/></div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>;
}

function LoanRow({loan,data}){
  const user=(data.usuarios||[]).find(x=>Number(x.id)===Number(loan.id_usuario));
  let book=(data.livros||[]).find(x=>Number(x.id)===Number(loan.id_livro));
  if(!book&&loan.id_exemplar!=null){
    const copy=(data.exemplares||[]).find(x=>Number(x.id)===Number(loan.id_exemplar));
    if(copy) book=(data.livros||[]).find(x=>Number(x.id)===Number(copy.id_livro));
  }
  const status=loan.status||'Registrado';
  return <div className="activity-row">
    <div className="activity-icon"><BookCopy size={17}/></div>
    <div className="activity-main">
      <strong>{book?.titulo||'Livro #'+(loan.id_livro??loan.id_exemplar??'—')}</strong>
      <span>{user?.nome||'Usuário #'+(loan.id_usuario??'—')}</span>
    </div>
    <div className="activity-meta">
      <StatusBadge value={status}/>
      <small>{formatDate(loan.data_emprestimo)}</small>
    </div>
  </div>;
}

function StatusBadge({value}){
  return <span className={'status-badge '+statusClass(value)}>{String(value||'—')}</span>;
}

function EmptyState({text,loading=false,compact=false}){
  return <div className={'empty '+(compact?'compact':'')}>
    <div className="empty-icon">{loading?<RefreshCw size={22} className="spin"/>:<Search size={22}/>}</div>
    <strong>{text}</strong>
    {!loading&&!compact&&<span>Tente ajustar a busca ou adicione um novo registro quando disponível.</span>}
  </div>;
}

function Table({rows,data,editable,onEdit,onDelete}){
  const keys=Object.keys(rows[0]||{}).filter(k=>k!=='senha');
  return <div className="tablewrap"><table>
    <thead><tr>{keys.map(k=><th key={k}>{labels[k]||k.replaceAll('_',' ')}</th>)}{editable&&<th>Ações</th>}</tr></thead>
    <tbody>{rows.map((row,i)=><tr key={row.id??i}>
      {keys.map(key=><td key={key}>
        {key==='status'?<StatusBadge value={row[key]}/>:displayValue(key,row[key],data)}
      </td>)}
      {editable&&<td><div className="row-actions">
        <button className="icon-btn" title="Editar" aria-label="Editar" onClick={()=>onEdit(row)}><Pencil size={15}/></button>
        <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={()=>onDelete(row)}><Trash2 size={15}/></button>
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
        <button className="close-btn" onClick={onClose} aria-label="Fechar"><X size={20}/></button>
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
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </form>
    </div>
  </div>;
}
