import 'package:flutter_test/flutter_test.dart';
import 'package:fintask/main.dart';

void main() {
  testWidgets('FintaskApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const FintaskApp());
    expect(find.byType(FintaskApp), findsOneWidget);
  });
}
