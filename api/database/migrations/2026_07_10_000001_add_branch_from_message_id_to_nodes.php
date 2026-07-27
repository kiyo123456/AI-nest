<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * この node が「親ノードのどの発話の直後で枝分かれしたか」を、
     * 位置(index)ではなく messages の実体(id)を指す FK で記録する。
     * ルートノードは分岐元を持たないため nullable。
     */
    public function up(): void
    {
        Schema::table('nodes', function (Blueprint $table) {
            $table->foreignId('branch_from_message_id')
                ->nullable()
                ->after('parent_id')
                ->constrained('messages')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('nodes', function (Blueprint $table) {
            $table->dropForeign(['branch_from_message_id']);
            $table->dropColumn('branch_from_message_id');
        });
    }
};
