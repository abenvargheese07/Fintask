class Stats {
  final int total;
  final int done;
  final int overdue;
  final int today;
  final int pending;

  const Stats({
    this.total = 0,
    this.done = 0,
    this.overdue = 0,
    this.today = 0,
    this.pending = 0,
  });

  factory Stats.fromJson(Map<String, dynamic> json) {
    return Stats(
      total: _asInt(json['total']),
      done: _asInt(json['done']),
      overdue: _asInt(json['overdue']),
      today: _asInt(json['today']),
      pending: _asInt(json['pending']),
    );
  }

  static int _asInt(dynamic val) {
    if (val is int) return val;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val) ?? 0;
    return 0;
  }

  Map<String, dynamic> toJson() {
    return {
      'total': total,
      'done': done,
      'overdue': overdue,
      'today': today,
      'pending': pending,
    };
  }

  int get completionPercent {
    if (total <= 0) return 0;
    return ((done / total) * 100).round();
  }
}
