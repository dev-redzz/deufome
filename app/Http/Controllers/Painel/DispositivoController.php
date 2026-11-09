<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Auditoria;
use Illuminate\Support\Facades\DB;

class DispositivoController extends Controller
{
    private const PAREAMENTO_MINUTOS = 10;

    private static function codigo(int $tenantId, int $deviceId): array
    {
        DB::update('UPDATE device_pairings SET usado_em = ? WHERE device_id = ? AND usado_em IS NULL', ['revogado', $deviceId]);
        do {
            $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (DB::scalar('SELECT 1 FROM device_pairings WHERE codigo = ? AND usado_em IS NULL AND expira_em > ?', [$codigo, agora()]));
        $expira = gmdate('Y-m-d H:i:s', time() + self::PAREAMENTO_MINUTOS * 60);
        DB::insert('INSERT INTO device_pairings (tenant_id, device_id, codigo, expira_em) VALUES (?,?,?,?)', [$tenantId, $deviceId, $codigo, $expira]);

        return ['codigo' => $codigo, 'expira_em' => $expira];
    }

    private static function mesa(int $tenantId, $tableId): ?int
    {
        if ($tableId === null || $tableId === '' || $tableId === 0) {
            return null;
        }
        $id = DB::scalar('SELECT id FROM tables WHERE id = ? AND tenant_id = ? AND ativo = 1', [(int) $tableId, $tenantId]) ?: erro(404, 'Mesa não encontrada.');

        return (int) $id;
    }

    private static function mesaLivre(int $tenantId, ?int $tableId, ?int $exceto = null): void
    {
        if (! $tableId) {
            return;
        }
        if ($nome = DB::scalar("SELECT nome FROM devices WHERE tenant_id = ? AND table_id = ? AND status <> 'bloqueado' AND id <> ?", [$tenantId, $tableId, $exceto ?? 0])) {
            erro(409, "Esta mesa já está vinculada ao $nome. Desvincule-o primeiro.");
        }
    }

    private static function doTenant(int $tenantId, int $id): array
    {
        return DB::selectOne('SELECT * FROM devices WHERE id = ? AND tenant_id = ?', [$id, $tenantId]) ?? erro(404, 'Dispositivo não encontrado.');
    }

    public function listar()
    {
        $u = usuario();
        $lista = DB::select('SELECT d.id, d.nome, d.status, d.last_seen_at, d.app_version, d.ip, d.table_id, m.numero AS mesa_numero, m.nome AS mesa_nome
            FROM devices d LEFT JOIN tables m ON m.id = d.table_id WHERE d.tenant_id = ? ORDER BY d.nome', [$u['tenant_id']]);
        foreach ($lista as &$d) {
            $d['online'] = $d['status'] === 'ativo' && Atendimento::online($d['last_seen_at']);
            $d['ativacao'] = DB::selectOne('SELECT codigo, expira_em FROM device_pairings WHERE device_id = ? AND usado_em IS NULL AND expira_em > ? ORDER BY id DESC LIMIT 1', [$d['id'], agora()]);
        }

        return response()->json([
            'dispositivos' => $lista,
            'mesas' => DB::select('SELECT id, numero, nome FROM tables WHERE tenant_id = ? AND ativo = 1 ORDER BY numero', [$u['tenant_id']]),
            'agora' => agora(),
            'pin' => (bool) DB::scalar('SELECT pin_gerente_hash FROM tenants WHERE id = ?', [$u['tenant_id']]),
        ]);
    }

    public function criar()
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $in = entrada();
        $nome = trim((string) ($in['nome'] ?? ''));
        if ($nome === '' || mb_strlen($nome) > 40) {
            erro(422, 'Dê um nome ao tablet (até 40 letras).');
        }
        $mesa = self::mesa($tid, $in['mesa_id'] ?? null);
        self::mesaLivre($tid, $mesa);
        $id = DB::table('devices')->insertGetId(['tenant_id' => $tid, 'table_id' => $mesa, 'nome' => $nome, 'created_at' => agora()]);
        $c = self::codigo($tid, $id);
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'dispositivo.criado', (string) $id, ['mesa' => $mesa]);

        return response()->json(['id' => $id, 'ativacao' => $c], 201);
    }

    public function mudarMesa(string $id)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $d = self::doTenant($tid, (int) $id);
        $mesa = self::mesa($tid, entrada()['mesa_id'] ?? null);
        self::mesaLivre($tid, $mesa, (int) $d['id']);
        DB::update('UPDATE devices SET table_id = ? WHERE id = ?', [$mesa, $d['id']]);
        Auditoria::registrar($tid, 'usuario:'.$u['id'], $mesa ? 'dispositivo.mesa_alterada' : 'dispositivo.desvinculado', (string) $d['id'], ['de' => $d['table_id'], 'para' => $mesa]);

        return response()->json(['ok' => true]);
    }

    public function bloquear(string $id)
    {
        $u = usuario();
        $d = self::doTenant((int) $u['tenant_id'], (int) $id);
        DB::update("UPDATE devices SET status = 'bloqueado' WHERE id = ?", [$d['id']]);
        DB::update("UPDATE device_pairings SET usado_em = 'revogado' WHERE device_id = ? AND usado_em IS NULL", [$d['id']]);
        Auditoria::registrar((int) $u['tenant_id'], 'usuario:'.$u['id'], 'dispositivo.bloqueado', (string) $d['id']);

        return response()->json(['ok' => true]);
    }

    public function credencial(string $id)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $d = self::doTenant($tid, (int) $id);
        if ($d['status'] === 'bloqueado') {
            self::mesaLivre($tid, $d['table_id'] ? (int) $d['table_id'] : null, (int) $d['id']);
        }
        DB::update("UPDATE devices SET status = 'pendente', token_hash = NULL WHERE id = ?", [$d['id']]);
        $c = self::codigo($tid, (int) $d['id']);
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'dispositivo.nova_credencial', (string) $d['id']);

        return response()->json(['ativacao' => $c]);
    }

    public function excluir(string $id)
    {
        $u = usuario();
        $d = self::doTenant((int) $u['tenant_id'], (int) $id);
        if ($d['status'] !== 'bloqueado') {
            erro(409, 'Bloqueie o tablet antes de excluir.');
        }
        DB::update('UPDATE table_sessions SET device_id = NULL WHERE device_id = ?', [$d['id']]);
        DB::delete('DELETE FROM device_pairings WHERE device_id = ?', [$d['id']]);
        DB::delete('DELETE FROM devices WHERE id = ?', [$d['id']]);
        Auditoria::registrar((int) $u['tenant_id'], 'usuario:'.$u['id'], 'dispositivo.excluido', (string) $d['id']);

        return response()->json(['ok' => true]);
    }
}
